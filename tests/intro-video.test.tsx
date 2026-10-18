import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DemoPlayer } from '../src/features/overview/DemoPlayer';
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('loads no YouTube iframe or thumbnail before the viewer chooses play', () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  const { container, unmount } = render(<DemoPlayer />);
  expect(container.querySelector('iframe')).toBeNull();
  expect(container.querySelector('img')?.src).toContain('/demo/signemo-poster.svg');
  fireEvent.click(screen.getByRole('button', { name: 'Xem video giới thiệu' }));
  expect(container.querySelector('video')?.src).toContain('/demo/signemo-intro-');
  expect(container.querySelector('iframe')).toBeNull();
  unmount();
  expect(container.querySelector('iframe')).toBeNull();
});

it('plays local video in isolated documents without requiring credentialless iframe support', () => {
  vi.stubGlobal('crossOriginIsolated', true);
  render(<DemoPlayer />);
  fireEvent.click(screen.getByRole('button', { name: 'Xem video giới thiệu' }));
  expect(document.querySelector('iframe')).toBeNull();
  expect(screen.getByRole('link', { name: 'Mở trên YouTube' })).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  );
  expect(screen.getByLabelText('Clip minh họa SignEmo')).toBeInTheDocument();
});

it('keeps a local fallback offline and requires another gesture after reconnect', () => {
  const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  const { container } = render(<DemoPlayer />);
  online.mockReturnValue(false);
  act(() => window.dispatchEvent(new Event('offline')));
  expect(container.querySelector('iframe')).toBeNull();
  expect(screen.getByRole('button', { name: 'Xem video giới thiệu' })).toBeDisabled();
  online.mockReturnValue(true);
  act(() => window.dispatchEvent(new Event('online')));
  expect(container.querySelector('iframe')).toBeNull();
  expect(screen.getByRole('button', { name: 'Xem video giới thiệu' })).toBeEnabled();
});
