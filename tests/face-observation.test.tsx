import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { FaceObservation } from '../src/features/face/FaceObservation';
import { emptyResult } from '../src/domain/face/prediction';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('waits for a persistent reason, avoids flicker, and removes diagnostics on stop', () => {
  vi.useFakeTimers();
  const result = {
    ...emptyResult(),
    status: 'poor-quality' as const,
    qualityReason: 'too-dark' as const,
    imageDiagnostics: {
      inputSize: 260,
      preprocessingVersion: 'roll-crop-v1',
      experiment: 'baseline' as const,
      gammaApplied: false,
    },
  };
  const view = render(<FaceObservation result={result} active />);
  act(() => vi.advanceTimersByTime(500));
  expect(screen.getByRole('status')).toHaveTextContent('Đang chờ');
  view.rerender(
    <FaceObservation result={{ ...result, timestamp: 200, qualityReason: 'blurred' }} active />,
  );
  act(() => vi.advanceTimersByTime(250));
  view.rerender(<FaceObservation result={{ ...result, timestamp: 400 }} active />);
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByRole('status')).toHaveTextContent('Tăng ánh sáng');
  expect(screen.getByText(/Crop RGB/)).toHaveTextContent('260×260');
  view.rerender(<FaceObservation result={result} active={false} />);
  expect(screen.queryByRole('status')).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});
