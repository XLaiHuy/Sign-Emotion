import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useFaceDisplay } from '../src/features/conversation/useFaceDisplay';
import { emptyResult } from '../src/domain/face/prediction';
import type { InferenceResult } from '../src/shared/contracts';
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('expires visual carry at 150 ms without extending it on another no-face result', () => {
  vi.useFakeTimers();
  const result: InferenceResult = { ...emptyResult(), status: 'valid', label: 'sad' };
  const { result: shown, rerender } = renderHook(
    ({ frame, enabled }) => useFaceDisplay(frame, enabled),
    { initialProps: { frame: result, enabled: true } },
  );
  rerender({ frame: emptyResult(), enabled: true });
  expect(shown.current).toEqual({ label: 'sad', carrying: true });
  act(() => vi.advanceTimersByTime(100));
  rerender({ frame: emptyResult(), enabled: true });
  act(() => vi.advanceTimersByTime(50));
  expect(shown.current.label).toBeNull();
  expect(result.label).toBe('sad');
});
it.each(['multiple-faces', 'poor-quality', 'uncertain'] as const)(
  'clears %s immediately and never carries after stop/camera switch',
  (status) => {
    const valid: InferenceResult = { ...emptyResult(), status: 'valid', label: 'angry' };
    const { result, rerender } = renderHook(
      ({ frame, enabled }) => useFaceDisplay(frame, enabled),
      { initialProps: { frame: valid, enabled: true } },
    );
    rerender({ frame: { ...emptyResult(), status }, enabled: true });
    expect(result.current.label).toBeNull();
    rerender({ frame: valid, enabled: true });
    rerender({ frame: emptyResult(), enabled: false });
    rerender({ frame: emptyResult(), enabled: true });
    expect(result.current.label).toBeNull();
  },
);
