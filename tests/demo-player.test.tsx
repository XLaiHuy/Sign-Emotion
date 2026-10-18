import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DemoPlayer } from '../src/features/overview/DemoPlayer';
vi.mock('../src/infrastructure/offline/optionalMedia', () => ({
  optionalMediaSaved: vi.fn(async () => false),
  saveOptionalMedia: vi.fn(async () => {}),
}));
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('does not request a video or iframe until a gesture, including isolated documents', () => {
  const { container } = render(<DemoPlayer />);
  expect(container.querySelector('video, iframe')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Xem video giới thiệu' }));
  const video = container.querySelector('video')!;
  expect(video.src).toContain('/demo/signemo-intro-');
  expect(video.autoplay).toBe(false);
  expect(video.controls).toBe(true);
  expect(container.querySelector('iframe')).toBeNull();
  fireEvent.error(video);
  expect(screen.getByRole('button', { name: 'Thử xem lại video' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Mở trên YouTube' })).toHaveAttribute(
    'href',
    'https://www.youtube.com/watch?v=g6lhRElRiWs',
  );
});
