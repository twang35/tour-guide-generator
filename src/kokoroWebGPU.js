let nextId = 0;

export class KokoroWebGPUClient {
  constructor() {
    this.worker = null;
    this.pending = new Map(); // id -> { resolve, reject }
    this.onProgress = null;
    this.onSourceChange = null;
  }

  static isSupported() {
    return typeof navigator !== 'undefined' && !!navigator.gpu;
  }

  async init({ dtype = 'fp32', onProgress, onSourceChange } = {}) {
    if (this.worker) return;

    this.onProgress = onProgress || null;
    this.onSourceChange = onSourceChange || null;

    this.worker = new Worker(
      new URL('./kokoroWebGPUWorker.js', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = (e) => {
      const { type, id, payload } = e.data;

      if (type === 'init-progress') {
        if (this.onProgress) this.onProgress(payload);
        return;
      }

      if (type === 'init-source') {
        if (this.onSourceChange) this.onSourceChange(payload);
        return;
      }

      const entry = this.pending.get(id);
      if (!entry) return;

      if (type.endsWith('-done')) {
        this.pending.delete(id);
        entry.resolve(payload);
      } else if (type.endsWith('-error')) {
        this.pending.delete(id);
        entry.reject(new Error(payload.message));
      }
    };

    this.worker.onerror = (err) => {
      console.error('KokoroWebGPU worker error:', err);
    };

    const result = await this._send('init', { dtype });
    return result.voices;
  }

  generate(text, voice, speed = 1.0) {
    return this._send('generate', { text, voice, speed }).then((r) => r.blob);
  }

  abortAll() {
    // Reject all pending promises
    for (const [id, entry] of this.pending) {
      entry.reject(new Error('Aborted'));
      this.pending.delete(id);
    }
  }

  dispose() {
    this.abortAll();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  _send(type, payload) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ type, id, payload });
    });
  }
}
