import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { expressions, expressionUI, settingsSchema } from '../src/shared/contracts';
import { classify, emptyResult } from '../src/domain/face/prediction';
import { fuse, type FusionDecision, type ModalityEvidence } from '../src/domain/conversation';
import { CaptionEntry } from '../src/features/conversation/CaptionEntry';
import { FaceWindow } from '../src/domain/faceWindow';
afterEach(cleanup);
const segment = {
  id: 'one',
  startMs: 0,
  endMs: 2000,
  text: 'Nội dung thử nghiệm',
  modelVersion: 'fixture',
  processingMs: 10,
  finalizedAtMs: 2100,
};
describe('seven-label product contract', () => {
  it('accepts fear and disgust in canonical face and fusion order, abstains on contempt', () => {
    for (const [label, index] of [
      ['fear', 6],
      ['disgust', 5],
    ] as const) {
      const scores = Array.from({ length: 8 }, (_, i) => (i === index ? 0.93 : 0.01));
      expect(classify(scores, 0.65).label).toBe(label);
      const evidence: ModalityEvidence[] = ['face', 'text'].map((source) => ({
        source: source as 'face' | 'text',
        startMs: 0,
        endMs: 2000,
        quality: 'usable',
        modelVersion: 'fixture',
        scores: { [label]: 0.9 },
        unsupportedScore: 0.1,
      }));
      expect(fuse(segment, evidence).label).toBe(label);
      const window = new FaceWindow();
      for (const timestamp of [0, 500, 1000, 1500])
        window.add({
          ...emptyResult(),
          timestamp,
          observationUsable: true,
          status: 'uncertain',
          decisionReason: 'stabilizing',
          scores,
          rawScores: scores,
        });
      expect(window.evidence(segment)?.scores[label]).toBeCloseTo(0.93);
    }
    expect(classify([0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.93], 0.65).label).toBeNull();
  });
  it('keeps legacy settings compatible and adds safe defaults', () => {
    const settings = settingsSchema.parse({
      threshold: 0.65,
      dwellMs: 200,
      cooldownMs: 3000,
      haptics: true,
      soundFeedback: false,
      cameraMirror: 'auto',
      asrProfile: 'product',
    });
    expect(settings.captionColors).toBe(true);
    expect(settings.expressionAvatar).toBe(true);
    expect(settingsSchema.parse({ ...settings, expressionAvatar: false }).expressionAvatar).toBe(
      false,
    );
    expect(expressions).toHaveLength(7);
    expect(expressionUI.neutral.pattern).toHaveLength(0);
    expect(expressionUI.fear.pattern).toEqual([70, 100, 70, 180, 240]);
    expect(expressionUI.disgust.pattern).toEqual([240, 180, 80]);
  });
  it('accents only the matching final agreement while caption text stays dark', () => {
    const decision: FusionDecision = {
      segmentId: 'one',
      label: 'fear',
      score: 0.9,
      contributors: ['face', 'text'],
      reason: 'agreement',
      experimental: true,
      configVersion: 'fixture',
    };
    const { rerender } = render(<CaptionEntry segment={segment} decision={decision} colors />);
    expect(screen.getByText(segment.text).style.color).toBe('');
    expect(
      screen.getByText(segment.text).parentElement?.style.getPropertyValue('--emotion-accent'),
    ).toBe(expressionUI.fear.color);
    rerender(<CaptionEntry segment={segment} decision={decision} colors={false} />);
    expect(screen.getByText(segment.text).style.color).toBe('');
    expect(
      screen.getByText(segment.text).parentElement?.style.getPropertyValue('--emotion-accent'),
    ).toBe('');
    expect(screen.getByText(/gợi ý thử nghiệm cho đoạn này/)).toBeInTheDocument();
    rerender(
      <CaptionEntry segment={segment} decision={{ ...decision, segmentId: 'old' }} colors />,
    );
    expect(screen.getByText(segment.text).style.color).toBe('');
  });
});
