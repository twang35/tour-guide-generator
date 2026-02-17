/* eslint-disable no-restricted-globals */
import { KokoroTTS } from 'kokoro-js';
import { env } from '@huggingface/transformers';

env.allowLocalModels = false;

const HF_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const LOCAL_MODEL_ID = 'kokoro-local';

function configureForHub() {
  env.remoteHost = 'https://huggingface.co/';
}

function configureForLocal() {
  env.remoteHost = self.location.origin;
}

let tts = null;

self.onmessage = async (e) => {
  const { type, id, payload } = e.data;

  switch (type) {
    case 'init': {
      try {
        const dtype = payload?.dtype || 'fp32';
        const progressCb = (progress) => {
          self.postMessage({ type: 'init-progress', id, payload: progress });
        };

        let source = 'hub';
        try {
          configureForHub();
          console.log('[KokoroWorker] Attempting to load model from Hugging Face Hub:', HF_MODEL_ID);
          self.postMessage({ type: 'init-source', id, payload: { source: 'hub' } });
          tts = await KokoroTTS.from_pretrained(HF_MODEL_ID, {
            dtype, device: 'webgpu', progress_callback: progressCb,
          });
        } catch (hubErr) {
          console.warn('HF Hub load failed, falling back to local:', hubErr.message);
          source = 'local';
          self.postMessage({ type: 'init-source', id, payload: { source: 'local' } });
          self.postMessage({ type: 'init-progress', id, payload: { status: 'progress', progress: 0 } });
          configureForLocal();
          console.log('[KokoroWorker] Attempting to load model from local server:', LOCAL_MODEL_ID);
          tts = await KokoroTTS.from_pretrained(LOCAL_MODEL_ID, {
            dtype, device: 'webgpu', progress_callback: progressCb,
          });
        }

        const voices = tts.list_voices();
        console.log('[KokoroWorker] Model loaded successfully from:', source);
        self.postMessage({ type: 'init-done', id, payload: { voices, source } });
      } catch (err) {
        self.postMessage({
          type: 'init-error',
          id,
          payload: { message: err.message },
        });
      }
      break;
    }

    case 'generate': {
      try {
        if (!tts) throw new Error('Model not loaded');
        const { text, voice, speed } = payload;
        const audio = await tts.generate(text, { voice, speed: speed || 1.0 });
        const blob = await audio.toBlob();
        self.postMessage({ type: 'generate-done', id, payload: { blob } });
      } catch (err) {
        self.postMessage({
          type: 'generate-error',
          id,
          payload: { message: err.message },
        });
      }
      break;
    }

    case 'dispose': {
      if (tts) {
        tts = null;
      }
      self.postMessage({ type: 'dispose-done', id });
      break;
    }

    default:
      break;
  }
};
