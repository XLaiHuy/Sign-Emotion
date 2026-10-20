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
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async () => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('plays short preview clip automatically (muted) and opens YouTube iframe only on modal gesture', () => {
  const { container } = render(<DemoPlayer />);
  const video = container.querySelector('video')!;
  expect(video).not.toBeNull();
  expect(video.src).toContain('/demo/signemo-preview-');
  expect(video.autoplay).toBe(true);
  expect(video.muted).toBe(true);
  expect(video.loop).toBe(true);

  // Before user clicks full video, no YouTube iframe exists
  expect(container.querySelector('iframe')).toBeNull();

  // Clicking full video button opens modal with YouTube iframe
  fireEvent.click(screen.getByRole('button', { name: /Xem video giới thiệu/i }));
  const iframe = document.querySelector('iframe');
  expect(iframe).not.toBeNull();
  expect(iframe?.src).toContain('https://www.youtube-nocookie.com/embed/E6AGaW7wE7k');

  // Verify external YouTube link
  const ytLinks = screen.getAllByRole('link', { name: /Mở trên YouTube/i });
  expect(ytLinks[0]).toHaveAttribute('href', 'https://www.youtube.com/watch?v=E6AGaW7wE7k');

  // Close modal via Close button
  fireEvent.click(screen.getByRole('button', { name: 'Đóng video' }));
  expect(document.querySelector('iframe')).toBeNull();
});

it('supports preview toggle and closing modal via Escape key', () => {
  render(<DemoPlayer />);
  const toggleBtn = screen.getByRole('button', { name: /clip xem trước/i });
  expect(toggleBtn).toBeInTheDocument();

  // Open modal
  fireEvent.click(screen.getByRole('button', { name: /Xem video giới thiệu/i }));
  expect(document.querySelector('iframe')).not.toBeNull();

  // Press ESC to close modal
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(document.querySelector('iframe')).toBeNull();
});
