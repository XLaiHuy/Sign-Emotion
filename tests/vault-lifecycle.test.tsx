import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useVault } from '../src/features/history/useVault';
vi.mock('../src/infrastructure/storage/vault', () => ({
  ConversationVault: class {
    unlocked = false;
    lock() {
      this.unlocked = false;
    }
    async prune() {}
    async save() {}
  },
}));
vi.mock('../src/infrastructure/audit/log', () => ({ emitAudit: vi.fn() }));
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it('does not extend the five-minute idle lock when automatic saves complete', async () => {
  vi.useFakeTimers();
  const { result, unmount } = renderHook(() => useVault());
  act(() => {
    (result.current.vault as { unlocked: boolean }).unlocked = true;
    result.current.refresh();
  });
  act(() => vi.advanceTimersByTime(299_000));
  await act(async () => {
    const record = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      segments: [
        {
          id: 'test',
          text: 'test-only',
          startMs: 0,
          endMs: 1,
          processingMs: 1,
          modelVersion: 'fixture',
          finalizedAtMs: 2,
        },
      ],
      decisions: [],
    };
    result.current.persistence.begin(record, true);
    result.current.persistence.offer(record);
    await Promise.resolve();
  });
  expect(result.current.saveState).toBe('saved');
  act(() => vi.advanceTimersByTime(1000));
  expect(result.current.vault.unlocked).toBe(false);
  unmount();
});
it('locks after five idle minutes, resets on interaction and locks immediately on background', () => {
  vi.useFakeTimers();
  const { result, unmount } = renderHook(() => useVault());
  act(() => {
    (result.current.vault as { unlocked: boolean }).unlocked = true;
    result.current.refresh();
  });
  act(() => vi.advanceTimersByTime(299_000));
  expect(result.current.vault.unlocked).toBe(true);
  act(() => document.dispatchEvent(new Event('pointerdown')));
  act(() => vi.advanceTimersByTime(299_000));
  expect(result.current.vault.unlocked).toBe(true);
  act(() => vi.advanceTimersByTime(1000));
  expect(result.current.vault.unlocked).toBe(false);
  act(() => {
    (result.current.vault as { unlocked: boolean }).unlocked = true;
    result.current.refresh();
  });
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(result.current.vault.unlocked).toBe(false);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
