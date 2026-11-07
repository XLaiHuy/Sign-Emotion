import { describe, expect, it } from 'vitest';
import {
  PredictionGate,
  applyBlendshapePrior,
  classify,
  defaultFaceCalibration,
  effectiveDwellMs,
  softmax,
} from '../src/domain/face/prediction';
import { MODEL_VERSION, defaultSettings, type InferenceResult } from '../src/shared/contracts';
const result = (
  timestamp: number,
  index = 1,
  status: InferenceResult['status'] = 'valid',
): InferenceResult => ({
  timestamp,
  label: null,
  score: 0,
  status,
  modelVersion: MODEL_VERSION,
  processingMs: 20,
  scores: Array.from({ length: 8 }, (_, i) => (i === index ? 0.99 : 0.01 / 7)),
});
describe('prediction gating', () => {
  it('adapts display dwell by margin without reducing the 400-ms haptic floor or retaining an invalid face', () => {
    expect([0.4, 0.25, 0.15].map((m) => effectiveDwellMs(200, m))).toEqual([120, 200, 320]);
    const gate = new PredictionGate(defaultSettings);
    gate.update(result(0));
    expect(gate.update(result(120))).toMatchObject({ result: { label: 'happy' }, trigger: null });
    expect(gate.update(result(150, 1, 'no-face')).result.label).toBeNull();
    expect(gate.update(result(200)).result.label).toBeNull();
  });
  it('waits for dwell, emits once, and respects the cooldown on a new expression', () => {
    const gate = new PredictionGate(defaultSettings);
    expect(gate.update(result(0)).trigger).toBeNull();
    expect(gate.update(result(200)).result.label).toBe('happy');
    expect(gate.update(result(200)).trigger).toBeNull();
    expect(gate.update(result(400)).trigger).toBe('happy');
    expect(gate.update(result(600)).trigger).toBeNull();
    for (let t = 1000; t <= 3000; t += 200) expect(gate.update(result(t, 4)).trigger).toBeNull();
    expect(gate.update(result(3600, 4)).trigger).toBe('angry');
  });
  it('clears a stale label immediately and never replays a held expression after face loss', () => {
    const gate = new PredictionGate(defaultSettings);
    gate.update(result(0));
    gate.update(result(600));
    const missing = gate.update(result(800, 1, 'no-face'));
    expect(missing.result.label).toBeNull();
    gate.update(result(4000));
    expect(gate.update(result(4600)).trigger).toBeNull();
  });
  it('keeps temporal stability across 1 Hz sampling and reports on the next fresh frame', () => {
    const gate = new PredictionGate(defaultSettings);
    gate.update(result(0));
    const next = gate.update(result(1005));
    expect(next.result.label).toBe('happy');
    expect(next.trigger).toBe('happy');
  });
  it('smooths scores by elapsed time and separates display dwell from haptic dwell', () => {
    const gate = new PredictionGate(defaultSettings);
    expect(gate.update(result(0)).result.label).toBeNull();
    const displayed = gate.update(result(200));
    expect(displayed.result.label).toBe('happy');
    expect(displayed.trigger).toBeNull();
    expect(gate.update(result(400)).trigger).toBe('happy');
  });
  it('rejects unsupported classes rather than renormalizing them into supported emotions', () => {
    expect(classify([0.01, 0.03, 0.01, 0.01, 0.02, 0.01, 0.01, 0.9], 0.65).label).toBeNull();
    const gate = new PredictionGate(defaultSettings);
    gate.update(result(0, 7));
    expect(gate.update(result(600, 7)).trigger).toBeNull();
  });
  it('creates logical events independently of motor mode and never for neutral', () => {
    const neutral = new PredictionGate(defaultSettings);
    neutral.update(result(0, 0));
    expect(neutral.update(result(600, 0)).trigger).toBeNull();
    const disabled = new PredictionGate({ ...defaultSettings, haptics: false });
    disabled.update(result(0));
    expect(disabled.update(result(600)).trigger).toBe('happy');
  });
  it('rearms only after a stable neutral and obeys cooldown', () => {
    const gate = new PredictionGate(defaultSettings);
    gate.update(result(0));
    gate.update(result(600));
    for (let t = 800; t < 3000; t += 200) gate.update(result(t, 0));
    for (let t = 3000; t < 5000; t += 200) gate.update(result(t));
    expect(gate.update(result(5000)).result.label).toBe('happy');
  });
  it('uses numerically stable softmax and rejects malformed values', () => {
    const scores = softmax([1001, 1000, 1000, 1000, 1000, 1000, 1000, 1000]);
    expect(scores.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(() => softmax([NaN])).toThrow();
    expect(classify([NaN], 0.65).label).toBeNull();
  });
  it('explains missed sad, supports per-class validation profiles, and retains raw scores', () => {
    const low = { ...result(0, 3), scores: [0.25, 0.01, 0.01, 0.6, 0.04, 0.03, 0.03, 0.03] };
    const base = new PredictionGate({ ...defaultSettings, threshold: 0.65 });
    expect(base.update(low).result.decisionReason).toBe('low-score');
    const tuned = new PredictionGate(defaultSettings, {
      thresholds: { sad: 0.55 },
      margins: { sad: 0.2 },
    });
    tuned.update(low);
    const accepted = tuned.update({ ...low, timestamp: 600 });
    expect(accepted.trigger).toBe('sad');
    expect(accepted.result.rawScores).toEqual(low.scores);
    expect(
      classify([0.6, 0.01, 0.01, 0.25, 0.04, 0.03, 0.03, 0.03], 0.5, {
        thresholds: { sad: 0.5 },
        margins: {},
      }).label,
    ).toBe('neutral');
  });
  it('resolves neutral/sad only with auxiliary evidence and preserves unsupported rejection', () => {
    const gate = new PredictionGate(defaultSettings);
    const aux = { scores: [0.05, 0.95], version: 'test', threshold: 0.8, margin: 0.15 };
    gate.update({ ...result(0, 0), auxiliary: aux });
    expect(gate.update({ ...result(600, 0), auxiliary: aux }).trigger).toBe('sad');
    gate.reset();
    gate.update({ ...result(0, 7), auxiliary: aux });
    expect(gate.update({ ...result(600, 7), auxiliary: aux }).result.decisionReason).toBe(
      'unsupported-class',
    );
    gate.reset();
    expect(gate.update({ ...result(0), auxiliary: aux }).result.decisionReason).toBe('stabilizing');
  });
  it('recognizes subtle happy, sad, fear, disgust and neutral fallback with defaultFaceCalibration and blendshape priors', () => {
    const profile = defaultFaceCalibration(defaultSettings.threshold);
    // Subtle smile (closed-mouth / cheek squint) boosted by blendshape prior
    const subtleSmileScores = applyBlendshapePrior(
      [0.32, 0.34, 0.04, 0.05, 0.03, 0.03, 0.03, 0.16],
      [
        { categoryName: 'mouthSmileLeft', score: 0.42 },
        { categoryName: 'mouthSmileRight', score: 0.44 },
        { categoryName: 'cheekSquintLeft', score: 0.3 },
        { categoryName: 'cheekSquintRight', score: 0.28 },
      ],
    );
    expect(classify(subtleSmileScores, defaultSettings.threshold, profile).label).toBe('happy');

    // Subtle sad boosted by frown + inner brow raise
    const subtleSadScores = applyBlendshapePrior(
      [0.36, 0.04, 0.03, 0.31, 0.05, 0.04, 0.04, 0.13],
      [
        { categoryName: 'mouthFrownLeft', score: 0.35 },
        { categoryName: 'mouthFrownRight', score: 0.35 },
        { categoryName: 'browInnerUp', score: 0.38 },
      ],
    );
    expect(classify(subtleSadScores, defaultSettings.threshold, profile).label).toBe('sad');

    // Subtle fear boosted by wide eyes + inner brow + mouth stretch
    const subtleFearScores = applyBlendshapePrior(
      [0.25, 0.03, 0.28, 0.06, 0.04, 0.04, 0.24, 0.06],
      [
        { categoryName: 'eyeWideLeft', score: 0.4 },
        { categoryName: 'eyeWideRight', score: 0.4 },
        { categoryName: 'browInnerUp', score: 0.42 },
        { categoryName: 'mouthStretchLeft', score: 0.32 },
        { categoryName: 'mouthStretchRight', score: 0.32 },
      ],
    );
    expect(classify(subtleFearScores, defaultSettings.threshold, profile).label).toBe('fear');

    // Subtle disgust boosted by nose sneer + upper lip raise + brow down
    const subtleDisgustScores = applyBlendshapePrior(
      [0.28, 0.03, 0.03, 0.1, 0.16, 0.24, 0.04, 0.12],
      [
        { categoryName: 'noseSneerLeft', score: 0.38 },
        { categoryName: 'noseSneerRight', score: 0.36 },
        { categoryName: 'mouthUpperUpLeft', score: 0.3 },
        { categoryName: 'mouthUpperUpRight', score: 0.3 },
        { categoryName: 'browDownLeft', score: 0.35 },
        { categoryName: 'browDownRight', score: 0.35 },
      ],
    );
    expect(classify(subtleDisgustScores, defaultSettings.threshold, profile).label).toBe('disgust');

    // Calm face where an active class slightly leads but is below threshold falls back to neutral instead of low-score
    const calmFace = [0.31, 0.33, 0.06, 0.08, 0.05, 0.05, 0.05, 0.07];
    expect(classify(calmFace, defaultSettings.threshold, profile)).toMatchObject({
      label: 'neutral',
      status: 'valid',
    });

    // Hold hysteresis maintains active expression across a slight score dip
    const gate = new PredictionGate(defaultSettings, profile);
    gate.update({ ...result(0, 1), scores: subtleSmileScores });
    const shown = gate.update({ ...result(200, 1), scores: subtleSmileScores });
    expect(shown.result.label).toBe('happy');
    const dipped = gate.update({
      ...result(400, 1),
      scores: [0.3, 0.34, 0.06, 0.06, 0.06, 0.06, 0.06, 0.06],
    });
    expect(dipped.result.label).toBe('happy');
  });
});
