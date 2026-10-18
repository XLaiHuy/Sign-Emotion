import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ExpressionMotion } from '../src/features/conversation/ExpressionMotion';
import { expressions } from '../src/shared/contracts';

afterEach(cleanup);
it('distinguishes all seven illustrations without producing a sign video or extra inference', () => {
  const shapes = new Set<string>();
  for (const label of expressions) {
    const view = render(<ExpressionMotion label={label} active cue={null} reduced={false} />);
    shapes.add(view.container.querySelector('svg')!.innerHTML);
    expect(view.container.querySelector('video, canvas')).toBeNull();
    expect(screen.getByText('Minh họa thử nghiệm, có thể sai.')).toBeInTheDocument();
    view.unmount();
  }
  expect(shapes.size).toBe(7);
});
it('animates a fresh cue once, preserves the DOM for the same cue, and stops on source loss', () => {
  const props = {
    label: 'angry' as const,
    active: true,
    reduced: false,
    cue: { id: 1, label: 'angry' as const, timestamp: performance.now() },
  };
  const view = render(<ExpressionMotion {...props} />);
  const svg = screen.getByRole('img');
  expect(svg).toHaveClass('expression-motion-once');
  view.rerender(<ExpressionMotion {...props} />);
  expect(screen.getByRole('img')).toBe(svg);
  fireEvent.click(screen.getByRole('button', { name: 'Xem lại minh họa' }));
  expect(screen.getByRole('img')).not.toBe(svg);
  view.rerender(<ExpressionMotion {...props} active={false} />);
  expect(screen.getByRole('img')).not.toHaveClass('expression-motion-once');
  expect(screen.getByText('Chưa có biểu cảm rõ')).toBeInTheDocument();
});
it('keeps reduced motion and stale cues static', () => {
  const props = {
    label: 'sad' as const,
    active: true,
    reduced: true,
    cue: { id: 1, label: 'sad' as const, timestamp: performance.now() },
  };
  const view = render(<ExpressionMotion {...props} />);
  expect(screen.getByRole('img')).not.toHaveClass('expression-motion-once');
  expect(screen.queryByRole('button')).toBeNull();
  view.rerender(
    <ExpressionMotion {...props} reduced={false} cue={{ ...props.cue, timestamp: -10000 }} />,
  );
  expect(screen.getByRole('img')).not.toHaveClass('expression-motion-once');
});
