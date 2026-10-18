import { cleanup, renderHook, act } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { useSignPlayback } from '../src/features/conversation/useSignPlayback';
import type { ConversationRecord } from '../src/domain/conversation';
import type { SignPhraseItem } from '../src/domain/signPhrases';
afterEach(cleanup);
it('does not replay old finals when signing is enabled during a conversation', () => {
  const catalogue: SignPhraseItem[] = [
    {
      id: 'test-only',
      text: 'Xin chào.',
      category: 'communication',
      source: 'test-only',
      status: 'playable',
      asset: {
        kind: 'video',
        url: '/signs/test-only.mp4',
        sha256: 'a'.repeat(64),
        source: 'test-only',
        license: 'test-only',
        selfChecked: true,
        technicalVerified: true,
      },
    },
  ];
  const record: ConversationRecord = {
    id: 'session',
    createdAt: new Date().toISOString(),
    segments: [
      {
        id: 'old',
        text: 'Xin chào.',
        startMs: 0,
        endMs: 100,
        modelVersion: 'fixture',
        processingMs: 1,
        finalizedAtMs: 110,
      },
    ],
    decisions: [],
  };
  const { result, rerender } = renderHook(
    ({ enabled, value }) => useSignPlayback(value, enabled, true, catalogue),
    { initialProps: { enabled: false, value: record } },
  );
  rerender({ enabled: true, value: record });
  expect(result.current.selection).toBeNull();
  rerender({
    enabled: true,
    value: { ...record, segments: [...record.segments, { ...record.segments[0], id: 'new' }] },
  });
  expect(result.current.selection?.id).toBe('new');
});

it('preserves manual sign selection when conversation is inactive/stopped', () => {
  const phrase: SignPhraseItem = {
    id: 'sent-27',
    text: 'Cảm ơn bạn rất nhiều.',
    category: 'communication',
    source: 'test',
    status: 'playable',
    asset: {
      kind: 'video',
      url: '/signs/SENT027.mp4',
      sha256: 'a'.repeat(64),
      source: 'test',
      license: 'test',
      selfChecked: true,
      technicalVerified: true,
    },
  };
  const record: ConversationRecord = {
    id: 'session-1',
    createdAt: new Date().toISOString(),
    segments: [],
    decisions: [],
  };
  const { result, rerender } = renderHook(
    ({ active, value }) => useSignPlayback(value, true, active, [phrase]),
    { initialProps: { active: false, value: record } },
  );

  expect(result.current.selection).toBeNull();

  // User manually selects phrase while mic is idle (active: false)
  act(() => {
    result.current.select(phrase);
  });
  expect(result.current.selection?.phrase.id).toBe('sent-27');
  expect(result.current.selection?.text).toBe('Cảm ơn bạn rất nhiều.');

  // Rerender with active still false (e.g. segment received, state unchanged)
  rerender({ active: false, value: record });
  expect(result.current.selection?.phrase.id).toBe('sent-27');

  // Manual close
  act(() => {
    result.current.clear();
  });
  expect(result.current.selection).toBeNull();
});
