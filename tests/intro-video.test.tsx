import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DemoPlayer } from '../src/features/overview/DemoPlayer';

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async () => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('loads no YouTube iframe before the viewer chooses to view the full video', () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  const { container, unmount } = render(<DemoPlayer />);
  expect(container.querySelector('iframe')).toBeNull();
  expect(container.querySelector('video')?.src).toContain('/demo/signemo-preview-');
  fireEvent.click(screen.getByRole('button', { name: /Xem video giới thiệu/i }));
  expect(document.querySelector('iframe')?.src).toContain(
    'https://www.youtube-nocookie.com/embed/E6AGaW7wE7k',
  );
  unmount();
  expect(document.querySelector('iframe')).toBeNull();
});

it('plays local video in isolated documents without requiring credentialless iframe support', () => {
  vi.stubGlobal('crossOriginIsolated', true);
  const { container } = render(<DemoPlayer />);
  const video = container.querySelector('video');
  expect(video).not.toBeNull();
  expect(video?.src).toContain('/demo/signemo-preview-');
  expect(screen.getByLabelText('Clip minh họa SignEmo')).toBeInTheDocument();
  const ytLink = screen.getByRole('link', { name: 'Mở trên YouTube' });
  expect(ytLink).toHaveAttribute('rel', 'noopener noreferrer');
});

it('displays an offline notice inside modal when offline and renders iframe when online', () => {
  const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  render(<DemoPlayer />);

  // Open modal while offline
  fireEvent.click(screen.getByRole('button', { name: /Xem video giới thiệu/i }));
  expect(document.querySelector('iframe')).toBeNull();
  expect(screen.getByText(/Clip YouTube cần có kết nối mạng/i)).toBeInTheDocument();

  // Close modal
  fireEvent.click(screen.getByRole('button', { name: 'Đóng video' }));

  // Reconnect online
  online.mockReturnValue(true);
  act(() => window.dispatchEvent(new Event('online')));

  // Reopen modal while online
  fireEvent.click(screen.getByRole('button', { name: /Xem video giới thiệu/i }));
  expect(document.querySelector('iframe')).not.toBeNull();
});
