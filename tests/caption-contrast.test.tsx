import { afterEach, expect, it } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { expressionUI, expressions } from '../src/shared/contracts';
import { CaptionEntry } from '../src/features/conversation/CaptionEntry';
import { emotionSurfaces } from '../src/shared/ui/emotionAppearance';
const luminance = (hex: string) => {
  const v = hex
    .slice(1)
    .match(/../g)!
    .map((x) => parseInt(x, 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return v[0] * 0.2126 + v[1] * 0.7152 + v[2] * 0.0722;
};
afterEach(cleanup);
it('keeps solid badges and pastel face fields readable for all seven emotions', () => {
  for (const label of expressions) {
    expect(
      (luminance('#ffffff') + 0.05) / (luminance(expressionUI[label].color) + 0.05),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      (luminance(emotionSurfaces[label]) + 0.05) / (luminance('#24322c') + 0.05),
    ).toBeGreaterThanOrEqual(4.5);
  }
});
it('retains accessible semantic colors and dark caption/badge text on white and ivory', () => {
  for (const label of expressions)
    for (const background of ['#ffffff', '#f7f6f1']) {
      expect(
        (luminance(background) + 0.05) / (luminance(expressionUI[label].color) + 0.05),
      ).toBeGreaterThanOrEqual(4.5);
    }
});
it('shows a label without an emergency role, never accents a mismatched or unknown decision', () => {
  const segment = {
    id: 'one',
    startMs: 0,
    endMs: 1000,
    text: 'Câu thử',
    modelVersion: 'fixture',
    processingMs: 1,
    finalizedAtMs: 1001,
  };
  const { rerender } = render(
    <CaptionEntry
      segment={segment}
      colors
      decision={{
        segmentId: 'one',
        label: 'angry',
        score: 0.9,
        contributors: ['face', 'text'],
        reason: 'agreement',
        experimental: true,
        configVersion: 'fixture',
      }}
    />,
  );
  expect(screen.getByText(/gợi ý thử nghiệm/)).toBeInTheDocument();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByText(segment.text)).toHaveClass('caption-text');
  expect(screen.getByText(segment.text).style.color).toBe('');
  rerender(<CaptionEntry segment={segment} colors />);
  expect(screen.queryByText(/gợi ý thử nghiệm/)).toBeNull();
  expect(
    screen.getByText(segment.text).parentElement?.style.getPropertyValue('--emotion-accent'),
  ).toBe('');
});
