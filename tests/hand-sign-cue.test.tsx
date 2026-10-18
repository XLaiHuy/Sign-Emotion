import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HandSignCue } from '../src/features/conversation/HandSignCue';
import type { SignVideoAsset } from '../src/shared/optionalMedia';
const assets: SignVideoAsset[] = ['happy', 'angry', 'sad'].map((expression) => ({
  expression: expression as SignVideoAsset['expression'],
  region: 'TP.HCM',
  source: 'https://example.org/fixture',
  license: 'test fixture, not shipped',
  attribution: 'Fixture',
  url: `/sign-language/fixture-${expression}.mp4`,
  bytes: 1,
  sha256: '0'.repeat(64),
  contentType: 'video/mp4',
}));
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(performance, 'now').mockReturnValue(5000);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('keeps only the newest cue while playing and clears the player when the source is lost', () => {
  const props = {
    label: 'happy' as const,
    active: true,
    enabled: true,
    assets,
    cue: { id: 1, label: 'happy' as const, timestamp: 4900 },
  };
  const view = render(<HandSignCue {...props} />);
  expect(view.container.querySelector('video')?.src).toContain('happy');
  view.rerender(
    <HandSignCue {...props} label="angry" cue={{ id: 2, label: 'angry', timestamp: 4950 }} />,
  );
  view.rerender(
    <HandSignCue {...props} label="sad" cue={{ id: 3, label: 'sad', timestamp: 4990 }} />,
  );
  fireEvent.ended(view.container.querySelector('video')!);
  expect(view.container.querySelector('video')?.src).toContain('sad');
  view.rerender(<HandSignCue {...props} active={false} label={null} cue={null} />);
  expect(view.container.querySelector('video')).toBeNull();
});
it('uses text for missing assets and never autoplays under reduced motion', () => {
  const props = {
    label: 'fear' as const,
    active: true,
    enabled: true,
    assets,
    cue: { id: 1, label: 'fear' as const, timestamp: 4900 },
  };
  const view = render(<HandSignCue {...props} />);
  expect(view.container.querySelector('video')).toBeNull();
  expect(screen.getByRole('img', { name: 'Minh họa Sợ hãi' })).toBeInTheDocument();
  expect(screen.getByText('Minh họa thử nghiệm, có thể sai.')).toBeInTheDocument();
  view.unmount();
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const reduced = render(
    <HandSignCue {...props} label="happy" cue={{ id: 2, label: 'happy', timestamp: 4900 }} />,
  );
  expect(reduced.container.querySelector('video')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Xem lại ký hiệu' }));
  expect(reduced.container.querySelector('video')).not.toBeNull();
});
