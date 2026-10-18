import { describe, expect, it } from 'vitest';
import { SignPlaybackQueue } from '../src/domain/sign/signPlayback';
import {
  findPlayableSignPhrase,
  signUtterances,
  signPhrases100Catalogue,
  type SignPhraseItem,
} from '../src/domain/signPhrases';
import type { TranscriptSegment } from '../src/domain/conversation';
const sample = (id: string, text: string): SignPhraseItem => ({
  id,
  text,
  category: 'communication',
  source: 'test fixture',
  status: 'playable',
  asset: {
    kind: 'video',
    url: `/signs/${id}.mp4`,
    sha256: 'a'.repeat(64),
    source: 'test-only',
    license: 'test fixture',
    selfChecked: true,
    technicalVerified: true,
  },
});
const catalogue = [sample('a', 'Xin chào.'), sample('b', 'Cảm ơn.'), sample('c', 'Xin lỗi.')];
describe('whole-utterance sign playback', () => {
  it('does not confuse a text catalogue with playable assets', () => {
    expect(signPhrases100Catalogue).toHaveLength(100);
    expect(
      signPhrases100Catalogue.every((p) => p.status === 'playable' && p.asset?.kind === 'video'),
    ).toBe(true);
    expect(findPlayableSignPhrase('Một câu ngẫu nhiên không có trong danh mục')).toBeUndefined();
    expect(findPlayableSignPhrase('Không cảm ơn.', catalogue)).toBeUndefined();
    expect(findPlayableSignPhrase('CẢM ƠN!', catalogue)?.id).toBe('b');
    const numbered = [sample('number', 'Nhiệt độ -1.5 độ.')];
    expect(findPlayableSignPhrase('Nhiệt độ 1.5 độ.', numbered)).toBeUndefined();
    expect(findPlayableSignPhrase('Nhiệt độ -1,5 độ.', numbered)).toBeUndefined();
  });
  it('finishes the current phrase and only retains the newest pending phrase', () => {
    const q = new SignPlaybackQueue();
    q.update([{ id: '1', text: 'Xin chào.' }], catalogue);
    q.update(
      [
        { id: '1', text: 'Xin chào.' },
        { id: '2', text: 'Cảm ơn.' },
        { id: '3', text: 'Xin lỗi.' },
      ],
      catalogue,
    );
    expect(q.current?.phrase.id).toBe('a');
    expect(q.pending?.phrase.id).toBe('c');
    q.finish();
    expect(q.current?.phrase.id).toBe('c');
    q.finish();
    expect(q.current).toBeNull();
    q.update(
      [
        { id: '1', text: 'Xin chào.' },
        { id: '2', text: 'Cảm ơn.' },
        { id: '3', text: 'Xin lỗi.' },
      ],
      catalogue,
    );
    expect(q.current).toBeNull();
  });
  it('cancels semantic revisions without generating another event', () => {
    const q = new SignPlaybackQueue();
    q.update([{ id: '1', text: 'Cảm ơn.' }], catalogue);
    q.update([{ id: '1', text: 'Không cảm ơn.' }], catalogue);
    expect(q.current).toBeNull();
    q.update([{ id: '1', text: 'Cảm ơn.' }], catalogue);
    expect(q.current).toBeNull();
  });
  it('never plays a hard cut, joins only the same utterance, and preserves negation', () => {
    const segment = (
      id: string,
      text: string,
      boundary: TranscriptSegment['boundary'],
      utteranceId = 'u',
    ): TranscriptSegment => ({
      id,
      text,
      boundary,
      utteranceId,
      startMs: 0,
      endMs: 100,
      processingMs: 1,
      finalizedAtMs: 110,
      modelVersion: 'test',
    });
    const first = segment('1', 'Không', 'limit');
    expect(signUtterances([first])).toEqual([]);
    expect(signUtterances([first, segment('2', 'cảm ơn.', 'silence')])[0].text).toBe(
      'Không cảm ơn.',
    );
    expect(signUtterances([first, segment('2', 'Cảm ơn.', 'silence', 'other')])[0].text).toBe(
      'Cảm ơn.',
    );
  });
});
