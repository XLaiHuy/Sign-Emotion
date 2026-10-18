import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { ConversationPage } from '../src/features/conversation/ConversationPage';
import { defaultSettings } from '../src/shared/contracts';

const mocks = vi.hoisted(() => {
  const noop = vi.fn();
  return {
    play: vi.fn(() => null),
    faceCallback: null as ((label: string) => unknown) | null,
    camera: {
      videoRef: { current: null },
      result: { status: 'valid', label: 'happy', scores: [], timestamp: 4000 },
      state: 'running',
      error: '',
      switching: false,
      prepare: vi.fn(async () => true),
      disposePrepared: noop,
      start: noop,
      stop: noop,
      clearError: noop,
      getMetrics: () => null,
      getModelVersion: () => 'test',
      getLiveP95: () => 1,
      getRecentServiceMs: () => 1,
      setFrameIntervalMs: noop,
      recordHaptic: noop,
    },
    conversation: {
      state: 'running',
      error: '',
      provisional: null,
      evidence: [],
      workload: { pendingAsr: 0, rtf: 0.1 },
      record: {
        id: 'session',
        segments: [{ id: 'one', startMs: 3000, endMs: 4000, text: 'Tôi đang buồn' }],
        decisions: [{ segmentId: 'one', label: 'sad', score: 0.9, reason: 'agreement' }],
      },
      prepare: vi.fn(async () => true),
      disposePrepared: noop,
      cancel: noop,
      start: noop,
      finish: noop,
      addFace: noop,
      resetFaceEvidence: noop,
      enableContext: noop,
      clearError: noop,
    },
    haptics: {
      cancel: noop,
      unlock: vi.fn(async () => true),
      testSound: noop,
      audioState: 'ready',
      visual: { active: false, pattern: [], playing: false, label: null },
    },
  };
});
vi.mock('../src/infrastructure/media/useCamera', () => ({
  useCamera: (_settings: unknown, callback: (label: string) => unknown) => {
    mocks.faceCallback = callback;
    return mocks.camera;
  },
}));
vi.mock('../src/features/conversation/useConversation', () => ({
  useConversation: () => mocks.conversation,
}));
vi.mock('../src/features/practice/useHaptics', () => ({
  useHaptics: () => ({ ...mocks.haptics, play: mocks.play }),
}));
vi.mock('../src/infrastructure/offline/preparationStatus', () => ({
  usePreparationStatus: () => ({
    coreReady: false,
    fusionReady: true,
    preparing: false,
    progress: 0,
    detail: '',
    error: '',
    offline: false,
  }),
  retryModelPreparation: vi.fn(),
}));
vi.mock('../src/infrastructure/audit/log', () => ({
  startupWasInterrupted: () => false,
  useAuditEvents: () => [],
  emitAudit: vi.fn(),
  setAuditPhase: vi.fn(),
  endAuditSession: vi.fn(),
  beginAuditSession: vi.fn(),
  reportPermissionFailure: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('emits face cues only; final fusion and transcript revisions never add another rhythm', () => {
  vi.spyOn(performance, 'now').mockReturnValue(5000);
  const props = {
    settings: defaultSettings,
    store: {
      vault: { unlocked: false, exists: async () => false },
      persistence: { unsaved: false },
      saveState: 'off',
      revision: 0,
    } as any,
    onActive: () => {},
  };
  const view = render(<ConversationPage {...props} />);
  expect(mocks.play).not.toHaveBeenCalled();
  act(() => {
    mocks.faceCallback?.('happy');
  });
  expect(mocks.play).toHaveBeenCalledExactlyOnceWith('happy', 'stable-change');
  mocks.conversation.record = {
    ...mocks.conversation.record,
    decisions: [{ segmentId: 'one', label: 'angry', score: 0.95, reason: 'agreement' }],
  };
  view.rerender(<ConversationPage {...props} />);
  expect(mocks.play).toHaveBeenCalledTimes(1);
  mocks.conversation.record = {
    ...mocks.conversation.record,
    segments: [{ id: 'old', text: 'Đoạn cũ', startMs: 0, endMs: 1000 }],
    decisions: [{ segmentId: 'old', label: 'angry', score: 0.95, reason: 'agreement' }],
  };
  view.rerender(<ConversationPage {...props} />);
  expect(mocks.play).toHaveBeenCalledTimes(1);
});
