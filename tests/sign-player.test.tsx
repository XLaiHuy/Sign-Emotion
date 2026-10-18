import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SignPhraseCard } from '../src/features/conversation/SignPhraseCard';
import type { SignPhraseItem } from '../src/domain/signPhrases';
vi.mock('../src/infrastructure/media/signAssets', () => ({
  readSignAsset: vi.fn(async () => new ArrayBuffer(3)),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('plays a verified video once, expands without another player and releases its object URL', async () => {
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:test-only'),
      revokeObjectURL: vi.fn(),
    }),
  );
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const phrase: SignPhraseItem = {
    id: 'fixture',
    text: 'Câu kiểm tra player',
    category: 'communication',
    source: 'test-only',
    status: 'playable',
    asset: {
      kind: 'video',
      url: '/signs/fixture.mp4',
      sha256: 'a'.repeat(64),
      source: 'test-only',
      license: 'test-only',
      selfChecked: true,
      technicalVerified: true,
    },
  };
  const end = vi.fn(),
    active = vi.fn();
  const { container, unmount } = render(
    <SignPhraseCard phrase={phrase} onClose={() => {}} onEnd={end} onActive={active} />,
  );
  const video = await screen.findByLabelText('Video ký hiệu: Câu kiểm tra player');
  expect(video).not.toHaveAttribute('loop');
  expect(active).toHaveBeenCalledWith(true);
  fireEvent.ended(video);
  expect(end).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Phóng to' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(container.querySelectorAll('video')).toHaveLength(1);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  unmount();
  expect(active).toHaveBeenLastCalledWith(false);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-only');
});
