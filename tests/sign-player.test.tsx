import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { SignPhraseCard } from '../src/features/conversation/SignPhraseCard';
import { QuickPhrasePicker } from '../src/features/conversation/QuickPhrasePicker';
import { useSignPlayback } from '../src/features/conversation/useSignPlayback';
import { signPhrases100Catalogue, type SignPhraseItem } from '../src/domain/signPhrases';
import type { ConversationRecord } from '../src/domain/conversation';
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
  const video = await screen.findByLabelText('Video ký hiệu: Câu kiểm tra player') as HTMLVideoElement;
  expect(video).not.toHaveAttribute('loop');
  expect(active).toHaveBeenCalledWith(true);
  const speedBtn = screen.getByRole('button', { name: 'Tốc độ 1×' });
  fireEvent.click(speedBtn);
  expect(screen.getByRole('button', { name: 'Tốc độ 0.75×' })).toHaveAttribute('aria-pressed', 'true');
  expect(video.playbackRate).toBe(0.75);
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

it('auto-closes QuickPhrasePicker overlay when a spoken or caption-clicked sign starts playing', () => {
  const { container, rerender } = render(
    <QuickPhrasePicker
      available={signPhrases100Catalogue}
      activeSelectionKey={undefined}
      onSelectPhrase={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: /Khám phá 100 mẫu câu ký hiệu/i }));
  expect(container.querySelector('.quick-phrase-content')).not.toBeNull();

  // Spoken utterance or caption badge triggers a new activeSelectionKey
  rerender(
    <QuickPhrasePicker
      available={signPhrases100Catalogue}
      activeSelectionKey="seg-2:SENT005"
      activePhraseText="Tôi biết rồi."
      onSelectPhrase={vi.fn()}
    />,
  );
  expect(container.querySelector('.quick-phrase-content')).toBeNull();
});

it('lets a newly spoken utterance override an earlier manual preview in useSignPlayback', () => {
  const firstSample = signPhrases100Catalogue[0]!;
  const spokenSample = signPhrases100Catalogue.find((item) => item.text === 'Tôi biết rồi.')!;

  const baseRecord: ConversationRecord = {
    id: 'session-1',
    createdAt: '2026-11-07T06:00:00.000Z',
    segments: [],
    decisions: [],
  };

  const { result, rerender } = renderHook(
    ({ record }) => useSignPlayback(record, true, true, signPhrases100Catalogue),
    { initialProps: { record: baseRecord } },
  );

  // User clicks a manual preview first
  act(() => {
    result.current.select(firstSample);
  });
  expect(result.current.selection?.phrase.id).toBe(firstSample.id);

  // User then speaks "Tôi biết rồi." into the microphone
  const updatedRecord: ConversationRecord = {
    ...baseRecord,
    segments: [
      {
        id: 'seg-spoken-1',
        utteranceId: 'utt-1',
        text: 'TÔI BIẾT RỒI',
        boundary: 'silence',
        startMs: 0,
        endMs: 1200,
        processingMs: 150,
        finalizedAtMs: 1350,
        modelVersion: 'gipformer-1.5-int8',
      },
    ],
  };

  rerender({ record: updatedRecord });
  expect(result.current.selection?.phrase.id).toBe(spokenSample.id);
});
