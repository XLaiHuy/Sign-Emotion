import { afterEach, expect, it, vi } from 'vitest';
import { waitForGpuCacheController } from '../src/infrastructure/inference/researchGpuRuntime';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('waits for the first service worker claim instead of failing a fresh browser', async () => {
  const service = Object.assign(new EventTarget(), { controller: null as object | null });
  vi.stubGlobal('navigator', { serviceWorker: service });
  const ready = vi.fn();
  const pending = waitForGpuCacheController().then(ready);
  await Promise.resolve();
  expect(ready).not.toHaveBeenCalled();
  service.controller = {};
  service.dispatchEvent(new Event('controllerchange'));
  await pending;
  expect(ready).toHaveBeenCalledOnce();
});
it('cancels the wait and bounds failure if offline preparation never takes control', async () => {
  vi.useFakeTimers();
  const service = Object.assign(new EventTarget(), { controller: null });
  vi.stubGlobal('navigator', { serviceWorker: service });
  const abort = new AbortController();
  const cancelled = expect(waitForGpuCacheController(abort.signal)).rejects.toMatchObject({
    name: 'AbortError',
  });
  abort.abort();
  await cancelled;
  expect(vi.getTimerCount()).toBe(0);
  const timed = expect(waitForGpuCacheController(undefined, 100)).rejects.toThrow(
    'Chưa chuẩn bị xong',
  );
  await vi.advanceTimersByTimeAsync(100);
  await timed;
  expect(vi.getTimerCount()).toBe(0);
});
