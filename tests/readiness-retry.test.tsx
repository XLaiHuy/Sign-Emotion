import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationPage } from '../src/features/conversation/ConversationPage';
import { defaultSettings } from '../src/shared/contracts';
import {
  registerPreparationRunner,
  updatePreparationStatus,
} from '../src/infrastructure/offline/preparationStatus';
import { ConversationPersistence } from '../src/infrastructure/storage/conversationPersistence';
import type { ConversationVault } from '../src/infrastructure/storage/vault';
import type { useVault } from '../src/features/history/useVault';

vi.mock('../src/infrastructure/inference/researchGpuRuntime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/infrastructure/inference/researchGpuRuntime')>()),
  prepareResearchGpuRuntime: vi.fn(async () => {}),
}));

class TestWorker {
  static fail = false;
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
  postMessage(data: { type: string }) {
    if (data.type !== 'init') return;
    TestWorker.inits.push(data);
    queueMicrotask(() => {
      const event = new MessageEvent('message', {
        data: TestWorker.fail ? { type: 'error', message: 'ASR init failed' } : { type: 'ready' },
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

describe('Conversation readiness and retry behavior', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    sessionStorage.removeItem('signemo.audit.startup');
    updatePreparationStatus({
      coreReady: true,
      fusionReady: true,
      preparing: false,
      offline: false,
      progress: 0,
      error: '',
    });
    TestWorker.fail = false;
    TestWorker.inits = [];
    TestWorker.instances = [];
    vi.stubGlobal('Worker', TestWorker);
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn() },
      userAgent: 'Windows',
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('R2: clicking "Thử chuẩn bị lại" resets error state, restarts preparation runner, and displays the progress bar', async () => {
    TestWorker.fail = true;
    const retrySpy = vi.fn(() => {
      updatePreparationStatus({ preparing: true, progress: 15 });
    });
    const unregister = registerPreparationRunner(retrySpy);

    render(<ConversationPage settings={defaultSettings} store={vaultStore} onActive={() => {}} />);

    // Initial failure triggers error UI
    const retryButton = await screen.findByRole('button', { name: 'Thử chuẩn bị lại' });
    expect(screen.getByText('AI chưa sẵn sàng cho phiên này.')).toBeInTheDocument();
    expect(
      screen.getByText('Chưa khởi tạo được phụ đề tiếng Việt trên thiết bị. Hãy thử chuẩn bị lại.'),
    ).toBeInTheDocument();

    // Now clicking retry
    TestWorker.fail = false;
    fireEvent.click(retryButton);

    // Verify preparation runner was called
    expect(retrySpy).toHaveBeenCalledOnce();

    // Verify progress bar is rendered and did not vanish
    await waitFor(() => {
      expect(screen.getByRole('progressbar', { name: 'Tiến độ chuẩn bị' })).toBeInTheDocument();
    });
    expect(screen.getByText(/Đang chuẩn bị SignEmo · 15%/)).toBeInTheDocument();

    unregister();
  });

  it('R1: automatically recovers from premature ASR failure once asset download completes', async () => {
    // Start with downloads in progress
    updatePreparationStatus({
      coreReady: true,
      fusionReady: false,
      preparing: true,
      offline: false,
      progress: 50,
      error: '',
    });
    TestWorker.fail = true;

    render(<ConversationPage settings={defaultSettings} store={vaultStore} onActive={() => {}} />);

    // Wait for the premature failure to appear
    await screen.findByText('AI chưa sẵn sàng cho phiên này.');
    expect(
      screen.getByText('Chưa khởi tạo được phụ đề tiếng Việt trên thiết bị. Hãy thử chuẩn bị lại.'),
    ).toBeInTheDocument();

    // Now worker will succeed as assets finish downloading
    TestWorker.fail = false;
    updatePreparationStatus({
      coreReady: true,
      fusionReady: true,
      preparing: false,
      offline: true,
      progress: 100,
      error: '',
    });

    // Auto-recovery cleans premature failure and achieves ready state
    await waitFor(() => {
      expect(screen.queryByText('AI chưa sẵn sàng cho phiên này.')).toBeNull();
    });
    expect(
      screen.queryByText('Chưa khởi tạo được phụ đề tiếng Việt trên thiết bị. Hãy thử chuẩn bị lại.'),
    ).toBeNull();

    // Button can now be enabled with consent
    fireEvent.click(screen.getByRole('checkbox', { name: /Tôi từ 18 tuổi/ }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Bắt đầu hội thoại' })).toBeEnabled();
    });
  });

  it('keeps progress bar visible when cached prepare finishes before ASR worker finishes loading', async () => {
    TestWorker.fail = true;
    let delayed = true;
    const pendingCallbacks: Array<() => void> = [];
    class DelayedWorker extends TestWorker {
      override postMessage(data: { type: string }) {
        if (data.type !== 'init') return;
        TestWorker.inits.push(data);
        if (TestWorker.fail) {
          queueMicrotask(() => {
            const event = new MessageEvent('message', {
              data: { type: 'error', message: 'ASR init failed' },
            });
            this.listeners.get('message')?.forEach((l) => l(event));
            this.onmessage?.(event);
          });
        } else if (delayed) {
          pendingCallbacks.push(() => {
            const event = new MessageEvent('message', { data: { type: 'ready' } });
            this.listeners.get('message')?.forEach((l) => l(event));
            this.onmessage?.(event);
          });
        } else {
          queueMicrotask(() => {
            const event = new MessageEvent('message', { data: { type: 'ready' } });
            this.listeners.get('message')?.forEach((l) => l(event));
            this.onmessage?.(event);
          });
        }
      }
    }
    vi.stubGlobal('Worker', DelayedWorker);

    updatePreparationStatus({
      coreReady: true,
      fusionReady: true,
      preparing: false,
      offline: true,
      progress: 100,
      error: '',
    });

    render(<ConversationPage settings={defaultSettings} store={vaultStore} onActive={() => {}} />);

    // Initial failure triggers error UI
    const retryButton = await screen.findByRole('button', { name: 'Thử chuẩn bị lại' });
    expect(screen.getByText('AI chưa sẵn sàng cho phiên này.')).toBeInTheDocument();

    // Now clicking retry
    TestWorker.fail = false;
    fireEvent.click(retryButton);

    // Prepare runner finishes checking cache immediately (preparing: false, offline: true)
    updatePreparationStatus({
      coreReady: true,
      fusionReady: true,
      preparing: false,
      offline: true,
      progress: 100,
      error: '',
    });

    // The progress bar MUST NOT disappear while worker is still loading!
    expect(screen.getByRole('progressbar', { name: 'Tiến độ chuẩn bị' })).toBeInTheDocument();
    expect(screen.getByText('Đang chuẩn bị AI trên thiết bị…')).toBeInTheDocument();

    // Now complete the pending workers
    delayed = false;
    pendingCallbacks.forEach((cb) => cb());

    // Now it transitions to ready and progress bar cleanly hides
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).toBeNull();
    });
    expect(screen.queryByText('Đang chuẩn bị AI trên thiết bị…')).toBeNull();
    expect(screen.queryByText('AI chưa sẵn sàng cho phiên này.')).toBeNull();
  });

  it('clicking "Thử chuẩn bị lại" immediately dismisses error to prevent duplicate trigger and keeps progress bar visible', async () => {
    TestWorker.fail = true;
    const retrySpy = vi.fn(() => {
      updatePreparationStatus({ preparing: true, progress: 10 });
    });
    const unregister = registerPreparationRunner(retrySpy);

    render(<ConversationPage settings={defaultSettings} store={vaultStore} onActive={() => {}} />);

    const retryButton = await screen.findByRole('button', { name: 'Thử chuẩn bị lại' });
    expect(screen.getByText('AI chưa sẵn sàng cho phiên này.')).toBeInTheDocument();

    TestWorker.fail = false;
    fireEvent.click(retryButton);

    // Initial click immediately starts retry
    expect(retrySpy).toHaveBeenCalledOnce();
    // Error message and button immediately unmount to prevent duplicate triggers
    expect(screen.queryByRole('button', { name: 'Thử chuẩn bị lại' })).toBeNull();
    expect(screen.queryByText('AI chưa sẵn sàng cho phiên này.')).toBeNull();

    // Progress bar must be present
    await waitFor(() => {
      expect(screen.getByRole('progressbar', { name: 'Tiến độ chuẩn bị' })).toBeInTheDocument();
    });

    unregister();
  });

  it('displays progress bar when retrying after preparationError', async () => {
    updatePreparationStatus({
      coreReady: false,
      fusionReady: false,
      preparing: false,
      offline: false,
      progress: 30,
      error: 'Không đủ dung lượng bộ nhớ thiết bị.',
    });

    const retrySpy = vi.fn(() => {
      updatePreparationStatus({
        preparing: true,
        progress: 0,
        error: '',
      });
    });
    const unregister = registerPreparationRunner(retrySpy);

    render(<ConversationPage settings={defaultSettings} store={vaultStore} onActive={() => {}} />);

    expect(screen.getByText('Chưa tải xong tài nguyên cần thiết.')).toBeInTheDocument();
    expect(screen.getByText('Không đủ dung lượng bộ nhớ thiết bị.')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    fireEvent.click(retryBtn);

    expect(retrySpy).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(screen.getByRole('progressbar', { name: 'Tiến độ chuẩn bị' })).toBeInTheDocument();
    });
    expect(screen.getByText(/Đang chuẩn bị SignEmo · 0%/)).toBeInTheDocument();

    unregister();
  });

  it('R1 (adversarial race condition): automatically recovers when downloads finish while ASR worker is still initializing and then fails', async () => {
    // Start with downloads in progress
    updatePreparationStatus({
      coreReady: true,
      fusionReady: false,
      preparing: true,
      offline: false,
      progress: 60,
      error: '',
    });

    let delayed = true;
    const pendingCallbacks: Array<() => void> = [];
    class InterleavedWorker extends TestWorker {
      override postMessage(data: { type: string }) {
        if (data.type !== 'init') return;
        TestWorker.inits.push(data);
        if (delayed) {
          pendingCallbacks.push(() => {
            const event = new MessageEvent('message', {
              data: TestWorker.fail ? { type: 'error', message: 'ASR init failed' } : { type: 'ready' },
            });
            this.listeners.get('message')?.forEach((l) => l(event));
            this.onmessage?.(event);
          });
        } else {
          queueMicrotask(() => {
            const event = new MessageEvent('message', {
              data: TestWorker.fail ? { type: 'error', message: 'ASR init failed' } : { type: 'ready' },
            });
            this.listeners.get('message')?.forEach((l) => l(event));
            this.onmessage?.(event);
          });
        }
      }
    }
    vi.stubGlobal('Worker', InterleavedWorker);
    TestWorker.fail = true;

    render(<ConversationPage settings={defaultSettings} store={vaultStore} onActive={() => {}} />);

    // Warmup started while preparing = true. Now downloads finish BEFORE the worker responds!
    updatePreparationStatus({
      coreReady: true,
      fusionReady: true,
      preparing: false,
      offline: true,
      progress: 100,
      error: '',
    });

    // Worker now fails after downloads completed
    expect(pendingCallbacks.length).toBeGreaterThan(0);
    delayed = false;
    TestWorker.fail = false; // Next attempt will succeed
    pendingCallbacks.forEach((cb) => cb());

    // Auto-recovery MUST immediately restart warmup and transition to ready state
    await waitFor(() => {
      expect(screen.queryByText('AI chưa sẵn sàng cho phiên này.')).toBeNull();
    });
    expect(
      screen.queryByText('Chưa khởi tạo được phụ đề tiếng Việt trên thiết bị. Hãy thử chuẩn bị lại.'),
    ).toBeNull();

    // Verify ready state
    fireEvent.click(screen.getByRole('checkbox', { name: /Tôi từ 18 tuổi/ }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Bắt đầu hội thoại' })).toBeEnabled();
    });
  });
});

