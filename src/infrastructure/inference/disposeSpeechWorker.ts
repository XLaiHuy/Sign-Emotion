import type { AsrProfileId } from '../../domain/asr';

const pending = new WeakMap<Worker, Promise<void>>();
/** Audio stops immediately in the session; streaming WASM gets bounded child cleanup before termination. */
export function disposeSpeechWorker(worker: Worker, profile: AsrProfileId) {
  if (profile !== 'moonshine-streaming-vi-research') {
    worker.terminate();
    return Promise.resolve();
  }
  const existing = pending.get(worker);
  if (existing) return existing;
  const task = new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      worker.removeEventListener('message', receive);
      worker.removeEventListener('error', finish);
      worker.terminate();
      resolve();
    };
    const receive = (event: MessageEvent) => {
      if (event.data?.type === 'disposed') finish();
    };
    const timer = setTimeout(finish, 5000);
    worker.addEventListener('message', receive);
    worker.addEventListener('error', finish);
    try {
      worker.postMessage({ type: 'dispose' });
    } catch {
      finish();
    }
  });
  pending.set(worker, task);
  return task;
}
