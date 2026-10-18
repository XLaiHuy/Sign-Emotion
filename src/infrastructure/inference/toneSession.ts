import type { ModalityEvidence } from '../../domain/conversation';
import type { SpeechAudioQuality } from '../../domain/audio';
import { makeWorkerReady } from './workerReady';

/** Dedicated SDK/worker: never opens a microphone and never mixes ORT runtimes. */
export class ToneSession {
  cacheAvailable = true;
  private worker = new Worker(new URL('./tone-live.worker.ts', import.meta.url), {
    type: 'module',
  });
  private cancelPending?: () => void;
  private disposed = false;
  async prepare(signal: AbortSignal) {
    const observe = ({ data }: MessageEvent) => {
      if (data.type === 'cache-warning') this.cacheAvailable = false;
    };
    this.worker.addEventListener('message', observe);
    try {
      await makeWorkerReady(this.worker, { type: 'init' }, signal);
    } finally {
      this.worker.removeEventListener('message', observe);
    }
  }
  infer(
    samples: Float32Array,
    startMs: number,
    endMs: number,
    quality: SpeechAudioQuality,
  ): Promise<ModalityEvidence | undefined> {
    if (this.disposed || this.cancelPending) return Promise.reject(new Error('Tone unavailable'));
    return new Promise((resolve, reject) => {
      const done = (evidence?: ModalityEvidence, failed = false) => {
        clearTimeout(timer);
        this.worker.removeEventListener('message', receive);
        this.worker.removeEventListener('error', fail);
        this.cancelPending = undefined;
        if (failed) reject(new Error('Tone unavailable'));
        else resolve(evidence);
      };
      const fail = () => done(undefined, true);
      const receive = ({ data }: MessageEvent) => {
        if (data.type === 'result') done(data.evidence);
        if (data.type === 'error') fail();
      };
      const timer = setTimeout(() => {
        this.worker.terminate();
        this.disposed = true;
        fail();
      }, 10_000);
      this.cancelPending = fail;
      this.worker.addEventListener('message', receive);
      this.worker.addEventListener('error', fail);
      const pcm = samples.slice();
      this.worker.postMessage({ type: 'infer', samples: pcm, startMs, endMs, quality }, [
        pcm.buffer,
      ]);
    });
  }
  dispose() {
    this.disposed = true;
    this.worker.terminate();
    this.cancelPending?.();
  }
}
