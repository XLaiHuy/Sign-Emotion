/** Two transfers at most; a file larger than the byte budget runs alone. */
export async function runAssetQueue<T extends { bytes: number }>(
  assets: readonly T[],
  prepare: (asset: T, progress: (received: number) => void, signal: AbortSignal) => Promise<void>,
  progress: (asset: T, done: number, total: number) => void,
  signal?: AbortSignal,
) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const received = assets.map(() => 0);
  const total = assets.reduce((sum, asset) => sum + asset.bytes, 0);
  const budget = 48 * 1048576;
  let cursor = 0;
  try {
    while (cursor < assets.length) {
      controller.signal.throwIfAborted();
      const batch = [cursor++];
      if (cursor < assets.length && assets[batch[0]].bytes + assets[cursor].bytes <= budget)
        batch.push(cursor++);
      const pending = batch.map(async (index) => {
        const asset = assets[index];
        const report = (bytes: number) => {
          controller.signal.throwIfAborted();
          received[index] = Math.max(received[index], Math.min(bytes, asset.bytes));
          progress(
            asset,
            received.reduce((sum, value) => sum + value, 0),
            total,
          );
        };
        report(0);
        await prepare(
          asset,
          (bytes) => report(Math.min(bytes, asset.bytes - 1)),
          controller.signal,
        );
        report(asset.bytes);
      });
      try {
        await Promise.all(pending);
      } catch (error) {
        controller.abort();
        await Promise.allSettled(pending);
        throw error;
      }
    }
  } finally {
    signal?.removeEventListener('abort', abort);
  }
}
