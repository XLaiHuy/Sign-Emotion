import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ConversationPage } from '../src/features/conversation/ConversationPage';
import { defaultSettings } from '../src/shared/contracts';
import { updatePreparationStatus } from '../src/infrastructure/offline/preparationStatus';
import type { useVault } from '../src/features/history/useVault';
import { ConversationPersistence } from '../src/infrastructure/storage/conversationPersistence';
import type { ConversationVault } from '../src/infrastructure/storage/vault';
vi.mock('../src/infrastructure/inference/researchGpuRuntime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/infrastructure/inference/researchGpuRuntime')>()),
  prepareResearchGpuRuntime: vi.fn(async () => {}),
}));

vi.mock('../src/infrastructure/media/microphone', () => ({
  MicrophoneCapture: class {
    stream?: MediaStream;
    start = vi.fn(async (_frame: unknown, _end: unknown, stream?: MediaStream) => {
      this.stream = stream;
      return true;
    });
    stop = vi.fn(() => this.stream?.getTracks().forEach((t) => t.stop()));
  },
}));
class TestStream {
  constructor(private tracks: MediaStreamTrack[]) {}
  getTracks() {
    return this.tracks;
  }
  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === 'video');
  }
  getAudioTracks() {
    return this.tracks.filter((t) => t.kind === 'audio');
  }
}
class TestAudioContext {
  static instances: TestAudioContext[] = [];
  constructor() {
    TestAudioContext.instances.push(this);
  }
  state = 'running';
  resume = vi.fn(async () => {});
  close = vi.fn(async () => {
    this.state = 'closed';
  });
}
class TestWorker {
  static fail = false;
  static failGpu = false;
  static inits: object[] = [];
  static instances: TestWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  terminated = false;
  constructor() {
    TestWorker.instances.push(this);
  }
  listeners = new Map<string, Set<EventListener>>();
  addEventListener(type: string, listener: EventListener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener);
  }
  postMessage(data: { type: string; faceProfile?: string }) {
    if (data.type === 'flush') {
      queueMicrotask(() =>
        this.onmessage?.(new MessageEvent('message', { data: { type: 'flushed' } })),
      );
      return;
    }
    if (data.type !== 'init') return;
    TestWorker.inits.push(data);
    queueMicrotask(() => {
      const event = new MessageEvent('message', {
        data:
          TestWorker.failGpu && data.faceProfile?.includes('webgpu')
            ? { type: 'error', code: 'gpu' }
            : TestWorker.fail
              ? { type: 'error', message: 'AI init failed' }
              : { type: 'ready' },
      });
      this.listeners.get('message')?.forEach((listener) => listener(event));
      this.onmessage?.(event);
    });
  }
  terminate() {
    this.terminated = true;
  }
}
const fakeVault = { unlocked: false, exists: async () => false } as ConversationVault;
const vaultStore = {
  vault: fakeVault,
  persistence: new ConversationPersistence(fakeVault),
  saveState: 'off',
  revision: 0,
  refresh: vi.fn(),
} as unknown as ReturnType<typeof useVault>;
const track = (kind: string, deviceId = kind === 'video' ? 'camera-1' : undefined) =>
  ({
    kind,
    readyState: 'live',
    stop: vi.fn(),
    addEventListener: vi.fn(),
    getSettings: () => ({ noiseSuppression: true, deviceId }),
  }) as unknown as MediaStreamTrack;
beforeEach(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  });
  sessionStorage.removeItem('signemo.audit.startup');
  updatePreparationStatus({
    coreReady: true,
    fusionReady: true,
    preparing: false,
    offline: true,
    error: '',
  });
  TestWorker.fail = false;
  TestWorker.failGpu = false;
  TestWorker.inits = [];
  TestWorker.instances = [];
  TestAudioContext.instances = [];
  vi.stubGlobal('Worker', TestWorker);
  vi.stubGlobal('MediaStream', TestStream);
  vi.stubGlobal('AudioContext', TestAudioContext);
  vi.stubGlobal('isSecureContext', true);
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: vi.fn() },
    userAgent: 'Windows',
  });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('offers an explicit B0 compatibility retry after GPU failure without opening devices', async () => {
  vi.stubEnv('VITE_AI_PROFILE', 'pc-candidate');
  TestWorker.failGpu = true;
  const getUserMedia = vi.fn();
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia }, userAgent: 'Windows' });
  render(<ConversationPage settings={defaultSettings} store={vaultStore} onActive={() => {}} />);
  const retry = await screen.findByRole('button', { name: 'Dùng chế độ tương thích' });
  expect(getUserMedia).not.toHaveBeenCalled();
  fireEvent.click(retry);
  fireEvent.click(screen.getByRole('checkbox', { name: /Tôi từ 18 tuổi/ }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Bắt đầu hội thoại' })).toBeEnabled(),
  );
  expect(TestWorker.inits).toContainEqual(
    expect.objectContaining({ faceProfile: 'b0-wasm-research' }),
  );
  expect(getUserMedia).not.toHaveBeenCalled();
  expect(screen.getByText(/Đang dùng chế độ tương thích/)).toBeInTheDocument();
});
async function open() {
  render(<ConversationPage settings={defaultSettings} store={vaultStore} onActive={() => {}} />);
  const consent = screen.getByRole('checkbox', { name: /Tôi từ 18 tuổi/ });
  fireEvent.click(consent);
  await waitFor(() => expect(consent).toBeChecked(), { timeout: 5000 });
  await waitFor(
    () => expect(screen.getByRole('button', { name: 'Bắt đầu hội thoại' })).toBeEnabled(),
    { timeout: 5000 },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu hội thoại' }));
}
it('requests both devices once, starts both pipelines, and stops every track on finish', async () => {
  const tracks = [track('video'), track('audio')];
  const getUserMedia = vi.fn(
    async (_constraints: MediaStreamConstraints) => new TestStream(tracks),
  );
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia },
    userAgent: 'Windows',
    permissions: undefined,
  });
  await open();
  await screen.findByRole('button', { name: 'Kết thúc hội thoại' });
  expect(getUserMedia).toHaveBeenCalledTimes(1);
  expect(getUserMedia.mock.calls[0]?.[0]).toEqual(
    expect.objectContaining({ audio: expect.any(Object), video: expect.any(Object) }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Kết thúc hội thoại' }));
  // Muted by default: only capture owns an AudioContext, and Finish closes it.
  expect(TestAudioContext.instances).toHaveLength(1);
  const prepareNew = await screen.findByRole('button', { name: 'Chuẩn bị phiên mới' });
  expect(TestAudioContext.instances[0]?.close).toHaveBeenCalledOnce();
  expect(tracks.every((t) => vi.mocked(t.stop).mock.calls.length > 0)).toBe(true);
  expect(TestWorker.instances.every((w) => w.terminated)).toBe(true);
  const workersBefore = TestWorker.instances.length;
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 75));
  });
  expect(TestWorker.instances.length).toBe(workersBefore);
  expect(screen.getByRole('button', { name: 'Bắt đầu hội thoại' })).toBeDisabled();
  fireEvent.click(prepareNew);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Bắt đầu hội thoại' })).toBeEnabled(),
  );
  expect(TestWorker.instances.length).toBeGreaterThan(workersBefore);
  expect(getUserMedia).toHaveBeenCalledTimes(1);
  cleanup();
});
it('does not report cancellation when the app moves to the background while idle', async () => {
  render(<ConversationPage settings={defaultSettings} store={vaultStore} onActive={() => {}} />);
  // Readiness is a UI capability, independent of audit coalescing and its five-row preview.
  fireEvent.click(screen.getByRole('checkbox', { name: /Tôi từ 18 tuổi/ }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Bắt đầu hội thoại' })).toBeEnabled(),
  );
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
  await waitFor(() => expect(TestWorker.instances.every((worker) => worker.terminated)).toBe(true));
  expect(screen.queryByText(/Đã hủy/)).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
});
it('preserves the interrupted-session marker on pagehide while stopping all media tracks', async () => {
  const tracks = [track('video'), track('audio')];
  const stopSpies = tracks.map((mediaTrack) => vi.spyOn(mediaTrack, 'stop'));
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: vi.fn(async () => new TestStream(tracks)) },
  });
  await open();
  await screen.findByRole('button', { name: 'Kết thúc hội thoại' });
  expect(JSON.parse(sessionStorage.getItem('signemo.audit.startup') ?? '{}').phase).toBe('running');

  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new Event('beforeunload'));
  await new Promise((resolve) => setTimeout(resolve, 120));
  window.dispatchEvent(new Event('pagehide'));

  expect(JSON.parse(sessionStorage.getItem('signemo.audit.startup') ?? '{}').phase).toBe('running');
  expect(stopSpies.every((spy) => spy.mock.calls.length > 0)).toBe(true);
});
it('stops a late permission grant after cancellation and releases prewarmed workers', async () => {
  const tracks = [track('video'), track('audio')];
  let grant!: (stream: TestStream) => void;
  const getUserMedia = vi.fn(
    () =>
      new Promise<TestStream>((resolve) => {
        grant = resolve;
      }),
  );
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia }, userAgent: 'Windows' });
  await open();
  fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
  await act(async () => grant(new TestStream(tracks)));
  expect(tracks.every((t) => vi.mocked(t.stop).mock.calls.length > 0)).toBe(true);
  expect(TestWorker.instances.length).toBeGreaterThanOrEqual(3);
  expect(TestWorker.instances.every((worker) => worker.terminated)).toBe(true);
});
it.each(['NotAllowedError', 'NotFoundError', 'NotReadableError'])(
  'shows %s beside controls and allows retry',
  async (name) => {
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException('device error', name));
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia }, userAgent: 'Windows' });
    await open();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Bắt đầu hội thoại' })).toBeEnabled();
  },
);
it('keeps captions available when the optional emotion worker fails', async () => {
  const tracks = [track('video'), track('audio')];
  const getUserMedia = vi.fn(async () => new TestStream(tracks));
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia },
    userAgent: 'Windows',
  });
  await open();
  TestWorker.fail = true;
  await screen.findByRole('button', { name: 'Kết thúc hội thoại' });
  await waitFor(() => expect(TestWorker.instances.at(-1)?.terminated).toBe(true));
  expect(getUserMedia).toHaveBeenCalledTimes(1);
  expect(tracks.every((track) => vi.mocked(track.stop).mock.calls.length === 0)).toBe(true);
  expect(screen.getByRole('heading', { name: 'Lời người đối diện' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Kết thúc hội thoại' }));
});
it('shows the front camera as a mirror and lets the user turn preview mirroring off', async () => {
  const getUserMedia = vi.fn(async () => new TestStream([track('video'), track('audio')]));
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia,
      enumerateDevices: vi.fn(async () => [{ kind: 'videoinput', deviceId: 'camera-1' }]),
    },
    userAgent: 'Windows',
  });
  await open();
  await screen.findByRole('button', { name: 'Kết thúc hội thoại' });
  const preview = screen.getByLabelText('Người đối diện');
  expect(preview).toHaveClass('is-mirrored');
  fireEvent.click(screen.getByRole('button', { name: 'Tắt lật gương ảnh camera' }));
  expect(preview).not.toHaveClass('is-mirrored');
  fireEvent.click(screen.getByRole('button', { name: 'Kết thúc hội thoại' }));
});
it('does not claim to switch cameras when the device has only one webcam', async () => {
  const getUserMedia = vi.fn(async () => new TestStream([track('video'), track('audio')]));
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia,
      enumerateDevices: vi.fn(async () => [{ kind: 'videoinput', deviceId: 'camera-1' }]),
    },
    userAgent: 'Windows',
  });
  await open();
  await screen.findByRole('button', { name: 'Kết thúc hội thoại' });
  fireEvent.click(screen.getByRole('button', { name: 'Đổi sang thiết bị camera khác' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Thiết bị chỉ có một camera.');
  expect(getUserMedia).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Kết thúc hội thoại' }));
});
it('switches only the video track and keeps the microphone session alive', async () => {
  const oldVideo = track('video', 'camera-1');
  const microphone = track('audio');
  const newVideo = track('video', 'camera-2');
  const getUserMedia = vi
    .fn()
    .mockResolvedValueOnce(new TestStream([oldVideo, microphone]))
    .mockResolvedValueOnce(new TestStream([newVideo]));
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia,
      enumerateDevices: vi.fn(async () => [
        { kind: 'videoinput', deviceId: 'camera-1' },
        { kind: 'videoinput', deviceId: 'camera-2' },
      ]),
    },
    userAgent: 'Windows',
  });
  await open();
  await screen.findByRole('button', { name: 'Kết thúc hội thoại' });
  fireEvent.click(screen.getByRole('button', { name: 'Đổi sang thiết bị camera khác' }));
  await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
  expect(getUserMedia.mock.calls[1]?.[0]).toEqual({
    audio: false,
    video: expect.objectContaining({ deviceId: { exact: 'camera-2' } }),
  });
  expect(oldVideo.stop).toHaveBeenCalled();
  expect(microphone.stop).not.toHaveBeenCalled();
  expect(newVideo.stop).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Kết thúc hội thoại' }));
});
