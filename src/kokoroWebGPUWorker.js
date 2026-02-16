/* eslint-disable no-restricted-globals */
import { KokoroTTS } from 'kokoro-js';
import { env } from '@huggingface/transformers';

// Point the transformers library at our local static files
// so it fetches model artifacts from our own server instead of HuggingFace Hub.
// The default path template is '{model}/resolve/{revision}/{file}', so files
// live under public/kokoro-local/resolve/main/*.
env.remoteHost = self.location.origin;
env.allowLocalModels = false;

let tts = null;

self.onmessage = async (e) => {
  const { type, id, payload } = e.data;

  switch (type) {
    case 'init': {
      try {
        const dtype = payload?.dtype || 'fp32';
        tts = await KokoroTTS.from_pretrained(
          'kokoro-local',
          {
            dtype,
            device: 'webgpu',
            progress_callback: (progress) => {
              self.postMessage({ type: 'init-progress', id, payload: progress });
            },
          }
        );
        const voices = tts.list_voices();
        self.postMessage({ type: 'init-done', id, payload: { voices } });
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
