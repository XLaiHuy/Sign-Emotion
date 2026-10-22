import { expect, it, vi } from 'vitest';
import { runAssetQueue } from '../src/infrastructure/offline/runAssetQueue';

it('overlaps two small files but runs large files alone with monotonic progress', async () => {
  const assets = [4, 4, 60 * 1048576, 4].map((bytes, id) => ({ bytes, id }));
  let active = 0;
  const sizes: number[] = [];
  const reported: number[] = [];
  const groups: number[][] = [];
  const running = new Set<number>();
  await runAssetQueue(
    assets,
    async (asset, progress) => {
      active++;
      running.add(asset.id);
      sizes.push(active);
      groups.push([...running]);
      progress(asset.bytes / 2);
      progress(0); // A server ignoring Range restarts the transfer.
      await new Promise((resolve) => setTimeout(resolve, 1));
      running.delete(asset.id);
      active--;
    },
    (_asset, done) => reported.push(done),
  );
  expect(Math.max(...sizes)).toBe(2);
  expect(groups.find((group) => group.includes(2))).toEqual([2]);
  expect(reported).toEqual([...reported].sort((a, b) => a - b));
  expect(reported.at(-1)).toBe(assets.reduce((sum, asset) => sum + asset.bytes, 0));
});

it('aborts and drains the other transfer on failure before rejecting', async () => {
  const failure = new Error('checksum');
  let siblingStopped = false;
  const started: number[] = [];
  await expect(
    runAssetQueue(
      [1, 2, 3].map((id) => ({ id, bytes: 4 })),
      async (asset, _progress, signal) => {
        started.push(asset.id);
        if (asset.id === 1) throw failure;
        await new Promise<void>((resolve) =>
          signal.addEventListener(
            'abort',
            () => {
              siblingStopped = true;
              resolve();
            },
            { once: true },
          ),
        );
      },
      vi.fn(),
    ),
  ).rejects.toBe(failure);
  expect(started).toEqual([1, 2]);
  expect(siblingStopped).toBe(true);
});

it('honors cancellation before starting or reporting another file', async () => {
  const controller = new AbortController();
  controller.abort();
  const prepare = vi.fn();
  await expect(
    runAssetQueue([{ bytes: 4 }], prepare, vi.fn(), controller.signal),
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(prepare).not.toHaveBeenCalled();
});

it('cancels both active transfers and never starts the next batch', async () => {
  const controller = new AbortController();
  const stopped: number[] = [];
  const started: number[] = [];
  const pending = runAssetQueue(
    [1, 2, 3].map((id) => ({ id, bytes: 4 })),
    async (asset, _report, signal) => {
      started.push(asset.id);
      await new Promise<void>((_resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => {
            stopped.push(asset.id);
            reject(signal.reason);
          },
          { once: true },
        );
      });
    },
    vi.fn(),
    controller.signal,
  );
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort();
  await rejected;
  expect(started).toEqual([1, 2]);
  expect(stopped).toEqual([1, 2]);
});
