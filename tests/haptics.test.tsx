import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useHaptics } from '../src/features/practice/useHaptics';
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'userAgentData');
});
describe('shared haptic playback', () => {
  it('simulates exact sad beats on PC and cancels at teardown', () => {
    vi.useFakeTimers();
    const vibrate = vi.fn((_pattern: number | number[]) => true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    const { result, unmount } = renderHook(() => useHaptics('visual'));
    vibrate.mockClear();
    act(() => {
      const event = result.current.play('sad');
      expect(event?.apiAccepted).toBe(false);
    });
    act(() => vi.advanceTimersByTime(0));
    expect(result.current.visual.active).toBe(true);
    act(() => vi.advanceTimersByTime(160));
    expect(result.current.visual.active).toBe(false);
    act(() => vi.advanceTimersByTime(220));
    expect(result.current.visual.active).toBe(true);
    act(() => vi.advanceTimersByTime(160));
    expect(result.current.visual.playing).toBe(false);
    expect(vibrate.mock.calls.every((args) => args[0] === 0)).toBe(true);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('counts API acceptance separately, respects off and cancels on background', () => {
    Object.defineProperty(navigator, 'userAgentData', {
      value: { mobile: true },
      configurable: true,
    });
    vi.useFakeTimers();
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    const { result, rerender } = renderHook(
      ({ mode }: { mode: 'auto' | 'off' }) => useHaptics(mode),
      { initialProps: { mode: 'auto' } },
    );
    act(() => {
      expect(result.current.play('happy')?.apiAccepted).toBe(true);
    });
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(result.current.visual.playing).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    rerender({ mode: 'off' });
    act(() => {
      expect(result.current.play('sad')).toBeNull();
    });
  });
});
