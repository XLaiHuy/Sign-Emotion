import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AvatarBoundary } from '../src/features/conversation/AvatarPanel';
import ExpressionAvatar from '../src/features/conversation/ExpressionAvatar';
afterEach(cleanup);
it('uses a neutral illustration for missing evidence without calling it a neutral prediction', () => {
  const { rerender } = render(<ExpressionAvatar expression={null} active={false} />);
  expect(document.querySelector('canvas')).toBeNull();
  rerender(<ExpressionAvatar expression="disgust" active={false} />);
  expect(document.querySelector('canvas')).toBeNull();
});
it('contains an optional illustration failure while keeping captions on screen', () => {
  const silence = vi.spyOn(console, 'error').mockImplementation(() => {});
  const Broken = () => {
    throw new Error('private exception must not enter audit');
  };
  try {
    render(
      <>
        <p>Phụ đề vẫn còn</p>
        <AvatarBoundary fallback={<p>Minh họa chưa sẵn sàng</p>}>
          <Broken />
        </AvatarBoundary>
      </>,
    );
    expect(screen.getByText('Phụ đề vẫn còn')).toBeInTheDocument();
    expect(screen.getByText('Minh họa chưa sẵn sàng')).toBeInTheDocument();
  } finally {
    silence.mockRestore();
  }
});
