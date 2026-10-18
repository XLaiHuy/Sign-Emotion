import {
  ModelInitializationError,
  workerInitializationCode,
} from '../../domain/modelInitialization';
export function makeWorkerReady(
  worker: Worker,
  message: object,
  signal?: AbortSignal,
  timeoutMs = 120_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Cancelled', 'AbortError'));
      return;
    }
    const finish = (error?: Error) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      worker.removeEventListener('message', receive);
      worker.removeEventListener('error', fail);
      if (error) reject(error);
      else resolve();
    };
    const timer = setTimeout(() => finish(new ModelInitializationError('timeout')), timeoutMs);
    const fail = () => finish(new ModelInitializationError('worker'));
    const abort = () => finish(new DOMException('Cancelled', 'AbortError'));
    const receive = (event: MessageEvent) => {
      if (event.data.type === 'ready') finish();
      if (event.data.type === 'error')
        finish(new ModelInitializationError(workerInitializationCode(event.data.code)));
    };
    signal?.addEventListener('abort', abort, { once: true });
    worker.addEventListener('message', receive);
    worker.addEventListener('error', fail);
    worker.postMessage(message);
  });
}
