import { fireEvent, render, screen, cleanup, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/app/App';
import { updatePreparationStatus } from '../src/infrastructure/offline/preparationStatus';
vi.mock('../src/infrastructure/offline/prepareAll', () => ({
  coreModelsReady: async () => true,
  allModelsReady: async () => true,
  prepareAllModels: async (_progress: unknown, ready: () => void) => {
    ready();
    return true;
  },
}));
vi.mock('../src/infrastructure/offline/packs', () => ({
  packReadiness: async () => ({ emotion: true }),
}));
vi.mock('../src/infrastructure/inference/researchGpuRuntime', () => ({
  prepareResearchGpuRuntime: vi.fn(async () => {}),
}));
afterEach(cleanup);
class ReadyWorker {
  static created = 0;
  constructor() {
    ReadyWorker.created++;
  }
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  private listeners = new Map<string, Set<EventListener>>();
  dispatchEvent(event: Event) {
    this.listeners.get(event.type)?.forEach((listener) => listener(event));
  }
  addEventListener(type: string, listener: EventListener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener);
  }
  postMessage(message: { type: string }) {
    if (message.type !== 'init') return;
    queueMicrotask(() => {
      const event = new MessageEvent('message', { data: { type: 'ready' } });
      this.listeners.get('message')?.forEach((listener) => listener(event));
      this.onmessage?.(event);
    });
  }
  terminate() {}
}
beforeEach(() => {
  ReadyWorker.created = 0;
  vi.stubGlobal('Worker', ReadyWorker);
});
afterEach(() => vi.unstubAllGlobals());
describe('consent and navigation', () => {
  it('recovers a waiting PWA update discovered before React subscribes without activating it', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
    const postMessage = vi.fn();
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: async () => ({ waiting: { postMessage } }) },
    });
    try {
      render(<App />);
      expect(await screen.findByRole('button', { name: 'Cập nhật và tải lại' })).toBeEnabled();
      expect(postMessage).not.toHaveBeenCalled();
    } finally {
      cleanup();
      if (descriptor) Object.defineProperty(navigator, 'serviceWorker', descriptor);
      else Reflect.deleteProperty(navigator, 'serviceWorker');
    }
  });
  it('explains a core warmup failure on the intro without requesting devices', async () => {
    updatePreparationStatus({ coreReady: true });
    // A native worker startup error rejects readiness before any permission.
    class CrashedWorker extends ReadyWorker {
      postMessage() {
        queueMicrotask(() => this.dispatchEvent(new Event('error')));
      }
    }
    vi.stubGlobal('Worker', CrashedWorker);
    render(<App />);
    await screen.findByText(
      'Chưa khởi tạo được phụ đề tiếng Việt trên thiết bị. Hãy thử chuẩn bị lại. Vào hội thoại để thử chuẩn bị lại.',
    );
    expect(screen.getByRole('button', { name: 'Vào hội thoại' })).toBeEnabled();
  });
  it('does not access the camera on launch and waits for local AI readiness after consent', async () => {
    updatePreparationStatus({ coreReady: true });
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'Theo dõi hội thoại bằng phụ đề tiếng Việt.' }),
    ).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
    await waitFor(() => expect(ReadyWorker.created).toBe(3));
    fireEvent.click(screen.getByRole('button', { name: 'Vào hội thoại' }));
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(ReadyWorker.created).toBe(3);
    expect(screen.getByRole('button', { name: 'Bắt đầu hội thoại' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /Tôi từ 18 tuổi/ }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Bắt đầu hội thoại' })).toBeEnabled(),
    );
    expect(getUserMedia).not.toHaveBeenCalled();
  });
  it('has a practice screen and never fabricates a remote admin dashboard', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Luyện nhịp rung' }));
    expect(screen.getAllByRole('button', { name: 'Thử nhịp' })).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Quản trị pilot' }));
    expect(screen.getByRole('heading', { name: 'Chưa kết nối Supabase' })).toBeInTheDocument();
  });
  it('exposes PC simulation and the local testing lab from settings', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Cài đặt' }));
    expect(screen.getByRole('option', { name: 'Chỉ mô phỏng hình ảnh' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mở phòng kiểm thử video' }));
    expect(screen.getByRole('heading', { name: 'Phòng kiểm thử' })).toBeInTheDocument();
    expect(screen.getByLabelText('Chọn video MP4/WebM')).toBeInTheDocument();
    expect(screen.getByText('Video YouTube tham khảo (tùy chọn)')).toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
  });
  it('automatically selects compatible face mode on GPU failure and informs the user on the home screen', async () => {
    updatePreparationStatus({ coreReady: true });
    vi.stubEnv('VITE_AI_PROFILE', 'pc-candidate');
    class FailGpuWorker extends ReadyWorker {
      postMessage(message: { type: string; faceProfile?: string }) {
        if (message.type !== 'init') return;
        queueMicrotask(() => {
          const event = new MessageEvent('message', {
            data: message.faceProfile?.includes('webgpu')
              ? { type: 'error', code: 'gpu' }
              : { type: 'ready' },
          });
          this.dispatchEvent(event);
          this.onmessage?.(event);
        });
      }
    }
    vi.stubGlobal('Worker', FailGpuWorker);
    render(<App />);
    expect(
      await screen.findByText(/Đang dùng chế độ tương thích cho khuôn mặt \(CPU\)/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thử lại tăng tốc GPU/ })).toBeInTheDocument();
  });
  it('allows the user to retry GPU acceleration from the intro and switch to compatible mode via direct button', async () => {
    updatePreparationStatus({ coreReady: true });
    vi.stubEnv('VITE_AI_PROFILE', 'pc-candidate');
    let failGpu = true;
    class FailGpuWorker extends ReadyWorker {
      postMessage(message: { type: string; faceProfile?: string }) {
        if (message.type !== 'init') return;
        queueMicrotask(() => {
          const event = new MessageEvent('message', {
            data:
              failGpu && message.faceProfile?.includes('webgpu')
                ? { type: 'error', code: 'gpu' }
                : { type: 'ready' },
          });
          this.dispatchEvent(event);
          this.onmessage?.(event);
        });
      }
    }
    vi.stubGlobal('Worker', FailGpuWorker);
    render(<App />);
    const retryGpuBtn = await screen.findByRole(
      'button',
      { name: /Thử lại tăng tốc GPU/ },
      { timeout: 10000 },
    );
    fireEvent.click(retryGpuBtn);
    const compatBtn = await screen.findByRole('button', { name: 'Dùng chế độ tương thích' });
    expect(compatBtn).toBeInTheDocument();
    fireEvent.click(compatBtn);
    expect(
      await screen.findByText(/Đang dùng chế độ tương thích cho khuôn mặt \(CPU\)/),
    ).toBeInTheDocument();
  }, 20000);
});
