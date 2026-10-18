import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useCamera } from '../src/infrastructure/media/useCamera';
import { defaultSettings } from '../src/shared/contracts';
vi.mock('../src/infrastructure/audit/log', () => ({ emitAudit: vi.fn() }));
class ReadyWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror = null;
  terminate = vi.fn();
  postMessage(data: { type: string }) {
    if (data.type === 'init')
      queueMicrotask(() =>
        this.onmessage?.(new MessageEvent('message', { data: { type: 'ready' } })),
      );
  }
}
function stream(deviceId: string) {
  const track = {
    readyState: 'live',
    stop: vi.fn(),
    addEventListener: vi.fn(),
    getSettings: () => ({ deviceId }),
  };
  return { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
}
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it.each(['restart', 'switch'] as const)(
  'rearms the video pump after %s cancels an un-fired scheduling timer',
  async (operation) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.stubGlobal('Worker', ReadyWorker);
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn(async () => stream('second')),
        enumerateDevices: vi.fn(async () => [
          { kind: 'videoinput', deviceId: 'first' },
          { kind: 'videoinput', deviceId: 'second' },
        ]),
      },
    });
    const video = document.createElement('video');
    video.play = vi.fn(async () => {});
    video.requestVideoFrameCallback = vi.fn(() => 1);
    video.cancelVideoFrameCallback = vi.fn();
    const { result } = renderHook(() => useCamera(defaultSettings, () => null));
    result.current.videoRef.current = video;
    await act(async () => {
      expect(await result.current.start('user', stream('first'))).toBe(true);
    });
    // Cancel the zero-delay arm before it requests a callback. A stale timer ID must not block the next arm.
    if (operation === 'restart') {
      act(() => result.current.stop());
      await act(async () => {
        expect(await result.current.start('user', stream('second'))).toBe(true);
      });
    } else {
      await act(async () => {
        expect(await result.current.switchCamera()).toBe(true);
      });
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(video.requestVideoFrameCallback).toHaveBeenCalledTimes(1);
  },
);
