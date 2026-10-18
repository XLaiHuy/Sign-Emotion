import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { FaceIllustration } from '../src/features/conversation/FaceIllustration';
vi.mock('../src/features/conversation/AvatarPanel', () => ({
  AvatarPanel: ({
    expression,
    onReady,
    onUnavailable,
  }: {
    expression: string;
    onReady: () => void;
    onUnavailable: () => void;
  }) => {
    useEffect(onReady, [onReady]);
    return <button onClick={onUnavailable}>GPU fixture {expression}</button>;
  },
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const props = {
  label: 'happy' as const,
  active: true,
  cue: null,
  use3D: true,
  allowed3D: true,
  colors: true,
};
it('colors the current face, respects color off and clears the illustration immediately on source loss', () => {
  const view = render(<FaceIllustration {...props} />);
  expect(screen.getByRole('button', { name: 'GPU fixture happy' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Minh họa nét mặt' })).toHaveStyle(
    '--face-accent: #7A5700',
  );
  expect(screen.getByRole('region', { name: 'Minh họa nét mặt' })).toHaveClass(
    'face-illustration-coloured',
  );
  view.rerender(<FaceIllustration {...props} colors={false} />);
  expect(screen.getByRole('region', { name: 'Minh họa nét mặt' })).toHaveStyle(
    '--face-accent: #426854',
  );
  expect(screen.getByRole('region', { name: 'Minh họa nét mặt' })).not.toHaveClass(
    'face-illustration-coloured',
  );
  view.rerender(<FaceIllustration {...props} active={false} />);
  expect(screen.queryByRole('button', { name: /GPU fixture/ })).toBeNull();
  expect(screen.getByText('Chưa có biểu cảm rõ')).toBeInTheDocument();
});
it('falls back to 2D on overload or GPU error without another cue or inference', () => {
  const view = render(<FaceIllustration {...props} allowed3D={false} />);
  expect(screen.queryByRole('button', { name: /GPU fixture/ })).toBeNull();
  expect(screen.getByRole('img', { name: 'Minh họa Vui' })).toBeInTheDocument();
  view.rerender(<FaceIllustration {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'GPU fixture happy' }));
  expect(screen.getByRole('img', { name: 'Minh họa Vui' })).toBeInTheDocument();
  expect(screen.getByText('Đang dùng hình 2D để giữ phụ đề hoạt động.')).toBeInTheDocument();
});
