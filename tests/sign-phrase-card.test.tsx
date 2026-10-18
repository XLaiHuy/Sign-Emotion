import { afterEach, expect, it } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { CaptionEntry } from '../src/features/conversation/CaptionEntry';
import type { TranscriptSegment } from '../src/domain/conversation';

afterEach(cleanup);

it('does not advertise a playable sign just because text exists in the catalogue', () => {
  const segment: TranscriptSegment = {
    id: 'test-1',
    startMs: 0,
    endMs: 1000,
    text: 'Xin viết ra giấy giúp tôi.',
    modelVersion: 'fixture',
    processingMs: 1,
    finalizedAtMs: 1001,
  };
  render(<CaptionEntry segment={segment} colors signLanguageCues />);
  expect(screen.queryByRole('button', { name: /Xem ký hiệu/ })).toBeNull();
});

it('does not render [Xem ký hiệu] button when phrase does not match any sign phrase', () => {
  const segment: TranscriptSegment = {
    id: 'test-2',
    startMs: 0,
    endMs: 1000,
    text: 'Hôm nay trời nắng đẹp ghê nhỉ.',
    modelVersion: 'fixture',
    processingMs: 1,
    finalizedAtMs: 1001,
  };

  render(<CaptionEntry segment={segment} colors signLanguageCues />);

  expect(screen.queryByRole('button', { name: /Xem ký hiệu/ })).toBeNull();
});

it('applies emotion surface and left border variables when agreement decision is present', () => {
  const segment: TranscriptSegment = {
    id: 'test-3',
    startMs: 0,
    endMs: 1000,
    text: 'Cảm ơn bạn rất nhiều.',
    modelVersion: 'fixture',
    processingMs: 1,
    finalizedAtMs: 1001,
  };

  const { container } = render(
    <CaptionEntry
      segment={segment}
      colors
      decision={{
        segmentId: 'test-3',
        label: 'happy',
        score: 0.92,
        contributors: ['face', 'text'],
        reason: 'agreement',
        experimental: true,
        configVersion: 'fixture',
      }}
    />,
  );

  const entry = container.querySelector('.caption-entry');
  expect(entry).toHaveClass('caption-entry-accented');
  expect(entry?.getAttribute('style')).toContain('--emotion-accent');
  expect(entry?.getAttribute('style')).toContain('--emotion-surface');
  expect(screen.getByText(/Vui/)).toBeInTheDocument();
});
