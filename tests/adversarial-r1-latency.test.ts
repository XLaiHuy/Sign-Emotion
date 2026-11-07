import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PredictionGate,
  classify,
  defaultFaceCalibration,
  effectiveDwellMs,
  emptyResult,
} from '../src/domain/face/prediction';
import { useFaceDisplay } from '../src/features/conversation/useFaceDisplay';
import { MODEL_VERSION, defaultSettings, type InferenceResult } from '../src/shared/contracts';

// Helper to generate normalized 8-class scores for a specific emotion
// 0: neutral, 1: happy, 2: surprise, 3: sad, 4: angry, 5: disgust, 6: fear, 7: contempt (unsupported)
const makeResult = (
  timestamp: number,
  index = 1,
  primaryScore = 0.96,
  status: InferenceResult['status'] = 'valid',
): InferenceResult => {
  const remainder = (1 - primaryScore) / 7;
  return {
    timestamp,
    label: null,
    score: primaryScore,
    status,
    modelVersion: MODEL_VERSION,
    processingMs: 15,
    scores: Array.from({ length: 8 }, (_, i) => (i === index ? primaryScore : remainder)),
  };
};

describe('Adversarial R1 Latency & Safety Verification', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe('Attack Vector 1: Decoupled Display Dwell vs Haptic Floor Safety (400ms)', () => {
    it('empirically verifies display emits at ~120ms while haptics are strictly suppressed until >= 400ms', () => {
      const gate = new PredictionGate(defaultSettings);

      // t = 0: initial frame (Happy)
      const f0 = gate.update(makeResult(0, 1, 0.98));
      expect(f0.result.label).toBeNull();
      expect(f0.trigger).toBeNull();
      expect(f0.result.decisionReason).toBe('stabilizing');

      // t = 60: before required dwell (effectiveDwellMs(200, 0.96) = 120)
      const f60 = gate.update(makeResult(60, 1, 0.98));
      expect(f60.result.label).toBeNull();
      expect(f60.trigger).toBeNull();

      // t = 120: dwell achieved! Display MUST emit, but haptic trigger MUST be null!
      const f120 = gate.update(makeResult(120, 1, 0.98));
      expect(f120.result.label).toBe('happy');
      expect(f120.result.status).toBe('valid');
      expect(f120.trigger).toBeNull(); // CRITICAL: NO HAPTIC BEFORE 400MS
      expect(f120.result.decisionReason).toBe('held-expression');

      // Intermediary steps up to 399ms: display held, haptics NEVER fire
      for (const t of [150, 200, 250, 300, 350, 399]) {
        const step = gate.update(makeResult(t, 1, 0.98));
        expect(step.result.label).toBe('happy');
        expect(step.trigger).toBeNull();
      }

      // t = 400: HAPTIC DWELL REACHED! Exactly at 400ms!
      const f400 = gate.update(makeResult(400, 1, 0.98));
      expect(f400.result.label).toBe('happy');
      expect(f400.trigger).toBe('happy'); // Trigger fires!
      expect(f400.result.decisionReason).toBe('stable-change');

      // t = 450: Haptic fires ONLY ONCE (single-shot pulse), display remains held
      const f450 = gate.update(makeResult(450, 1, 0.98));
      expect(f450.result.label).toBe('happy');
      expect(f450.trigger).toBeNull();
      expect(f450.result.decisionReason).toBe('held-expression');
    });

    it('guarantees 3000ms haptic cooldown across rapid consecutive emotion shifts', () => {
      const gate = new PredictionGate(defaultSettings);

      // Trigger happy at t = 400ms
      gate.update(makeResult(0, 1, 0.98));
      gate.update(makeResult(120, 1, 0.98));
      const trigHappy = gate.update(makeResult(400, 1, 0.98));
      expect(trigHappy.trigger).toBe('happy');

      // User immediately shifts to Angry at t = 500ms
      // Because EMA has tau = 150ms and Happy was held at 0.98, at t = 500 (100ms later),
      // EMA is still transitioning. By t = 620ms, Angry has fully crossed over as candidate.
      gate.update(makeResult(500, 4, 0.98)); // Angry frame 1
      const f620 = gate.update(makeResult(620, 4, 0.98)); // Angry frame 2: crossover established
      // Stabilizing dwell is active
      expect(f620.result.decisionReason).toMatch(/stabilizing|cooldown/);

      // Display emits Angry rapidly once required dwell (~120ms) is reached (t = 750ms)
      const f750 = gate.update(makeResult(750, 4, 0.98));
      expect(f750.result.label).toBe('angry');
      expect(f750.trigger).toBeNull(); // Still in cooldown!

      // At t = 1050ms (candidateAge >= 400ms for angry), candidateAge >= 400ms is satisfied,
      // but elapsed since lastHaptic is only 650ms (< 3000ms cooldown)
      const f1050 = gate.update(makeResult(1050, 4, 0.98));
      expect(f1050.result.label).toBe('angry');
      expect(f1050.trigger).toBeNull(); // COOLDOWN PREVENTS MOTOR OVERLOAD
      expect(f1050.result.decisionReason).toBe('held-expression');

      // Even at t = 3399ms (lastHaptic + 2999ms), trigger is still blocked
      const f3399 = gate.update(makeResult(3399, 4, 0.98));
      expect(f3399.trigger).toBeNull();
      expect(f3399.result.decisionReason).toBe('held-expression');

      // At t = 3400ms (exactly 3000ms after t = 400ms), cooldown expires and trigger fires for Angry!
      const f3400 = gate.update(makeResult(3400, 4, 0.98));
      expect(f3400.result.label).toBe('angry');
      expect(f3400.trigger).toBe('angry');
      expect(f3400.result.decisionReason).toBe('stable-change');
    });

    it('cancels haptic candidate immediately if face drops or twitches before 400ms', () => {
      const gate = new PredictionGate(defaultSettings);

      // Happy starts at t = 0, emits display at t = 120ms
      gate.update(makeResult(0, 1, 0.98));
      const f120 = gate.update(makeResult(120, 1, 0.98));
      expect(f120.result.label).toBe('happy');
      expect(f120.trigger).toBeNull();

      // At t = 350ms (before 400ms haptic floor), face disappears or goes invalid
      const f350 = gate.update(makeResult(350, 1, 0.98, 'no-face'));
      expect(f350.result.label).toBeNull();
      expect(f350.trigger).toBeNull();

      // Face reappears at t = 400ms: candidate timer was cleared, so NO premature haptic
      const f400 = gate.update(makeResult(400, 1, 0.98));
      expect(f400.result.label).toBeNull();
      expect(f400.trigger).toBeNull();
      expect(f400.result.decisionReason).toBe('stabilizing');
    });
  });

  describe('Attack Vector 2: High-Frequency Noise & Oscillation Immunity', () => {
    it('EMA smoothing and dwell gate completely prevent flickering under 30Hz oscillating noise', () => {
      const gate = new PredictionGate(defaultSettings);
      const emittedLabels: (string | null)[] = [];
      const triggers: (string | null)[] = [];

      // Alternate between Happy (1) and Angry (4) every 33ms (simulating noisy frames)
      for (let frame = 0; frame < 30; frame++) {
        const t = frame * 33;
        const emotionIdx = frame % 2 === 0 ? 1 : 4;
        const out = gate.update(makeResult(t, emotionIdx, 0.75));
        emittedLabels.push(out.result.label);
        triggers.push(out.trigger);
      }

      // No stable emotion ever reached dwell or clear separation in EMA
      const validEmissions = emittedLabels.filter((l) => l !== null);
      expect(validEmissions.length).toBe(0);
      expect(triggers.filter((tr) => tr !== null).length).toBe(0);
    });

    it('hysteresis prevents dropouts when scores fluctuate around threshold boundary', () => {
      const profile = defaultFaceCalibration(0.65);
      const gate = new PredictionGate(defaultSettings, profile);

      // Establish Happy (score 0.70 > 0.65 threshold)
      gate.update(makeResult(0, 1, 0.72));
      const stableHappy = gate.update(makeResult(200, 1, 0.72));
      expect(stableHappy.result.label).toBe('happy');

      // Score dips to 0.58 on frame 3 (below base threshold 0.65, but above 0.65 * 0.85 = 0.5525 hysteresis)
      const dipResult = makeResult(400, 1, 0.58);
      const dipOutput = gate.update(dipResult);

      // Thanks to activeProfile hysteresis (heldLabel), happy remains valid and does NOT drop out!
      expect(dipOutput.result.label).toBe('happy');
      expect(dipOutput.result.status).toBe('valid');
    });
  });

  describe('Attack Vector 3: Neutral Transition Dynamics & Dwell Normalization', () => {
    it('neutral at cold startup emits with 0 dwell, but returning to neutral requires dwell', () => {
      const profile = defaultFaceCalibration(0.65);
      const gate = new PredictionGate(defaultSettings, profile);

      // Cold startup: neutral at t=0
      // Profile neutral dwell is 0 if (lastDisplayEmitted ?? lastEmitted) === null
      const coldNeutral = gate.update(makeResult(0, 0, 0.95));
      expect(coldNeutral.result.label).toBe('neutral');
      expect(coldNeutral.trigger).toBeNull();

      // Express Happy starting at t=100
      gate.update(makeResult(100, 1, 0.98)); // Frame 1: EMA crossover in progress
      gate.update(makeResult(220, 1, 0.98)); // Frame 2: Happy candidate confirmed
      const happyEmitted = gate.update(makeResult(350, 1, 0.98)); // Frame 3: Dwell reached
      expect(happyEmitted.result.label).toBe('happy');

      // Return to neutral at t=1000
      // Since lastDisplayEmitted is 'happy', neutral MUST NOT immediately snap in 0ms (which would cause flicker)
      const neutralReturn0 = gate.update(makeResult(1000, 0, 0.95));
      expect(neutralReturn0.result.label).toBeNull();
      expect(neutralReturn0.result.decisionReason).toBe('stabilizing');

      // Once neutral dwell elapses (~120ms)
      const neutralReturn1 = gate.update(makeResult(1120, 0, 0.95));
      expect(neutralReturn1.result.label).toBe('neutral');
    });
  });

  describe('Attack Vector 4: useFaceDisplay Transition Acceleration & Carry Invariants', () => {
    it('instantly drops stale previous emotion when transitioning to a new emotion, eliminating visual lag', () => {
      vi.useFakeTimers();

      // Initial state: valid Happy
      const happyResult: InferenceResult = { ...emptyResult(), status: 'valid', label: 'happy' };
      const { result, rerender } = renderHook(
        ({ frame, enabled }) => useFaceDisplay(frame, enabled),
        { initialProps: { frame: happyResult, enabled: true } },
      );
      expect(result.current).toEqual({ label: 'happy', carrying: false });

      // Stabilizing frame arriving with scores indicating transition toward ANGRY (index 4)
      const angryLeadingScores = [0.05, 0.1, 0.05, 0.05, 0.65, 0.04, 0.03, 0.03];
      const stabilizingToAngry: InferenceResult = {
        ...emptyResult('uncertain'),
        decisionReason: 'stabilizing',
        scores: angryLeadingScores,
      };

      rerender({ frame: stabilizingToAngry, enabled: true });

      // Crucial R1 assertion: `isTransitioningToOther` is TRUE!
      // Must NOT carry 'happy' for 350ms! Must drop stale happy immediately!
      expect(result.current.label).toBeNull();
      expect(result.current.carrying).toBe(false);

      // Next frame: angry is confirmed valid
      const angryValid: InferenceResult = {
        ...emptyResult(),
        status: 'valid',
        label: 'angry',
        scores: angryLeadingScores,
      };
      rerender({ frame: angryValid, enabled: true });
      expect(result.current).toEqual({ label: 'angry', carrying: false });
    });

    it('preserves 350ms carry when stabilizing frame is within the SAME emotion (preventing micro-flicker)', () => {
      vi.useFakeTimers();

      // Initial state: valid Happy (index 1)
      const happyScores = [0.05, 0.8, 0.05, 0.02, 0.02, 0.02, 0.02, 0.02];
      const happyResult: InferenceResult = {
        ...emptyResult(),
        status: 'valid',
        label: 'happy',
        scores: happyScores,
      };
      const { result, rerender } = renderHook(
        ({ frame, enabled }) => useFaceDisplay(frame, enabled),
        { initialProps: { frame: happyResult, enabled: true } },
      );
      expect(result.current).toEqual({ label: 'happy', carrying: false });

      // Frame dips into stabilizing, but Happy is STILL leading in scores
      const happyDippedScores = [0.15, 0.5, 0.1, 0.05, 0.05, 0.05, 0.05, 0.05];
      const stabilizingSameHappy: InferenceResult = {
        ...emptyResult('uncertain'),
        decisionReason: 'stabilizing',
        scores: happyDippedScores,
      };

      rerender({ frame: stabilizingSameHappy, enabled: true });

      // Same emotion dip: must carry 'happy' to prevent annoying visual flicker
      expect(result.current).toEqual({ label: 'happy', carrying: true });

      // Within 300ms, face recovers
      act(() => vi.advanceTimersByTime(300));
      expect(result.current).toEqual({ label: 'happy', carrying: true });

      // After 350ms total, carry expires
      act(() => vi.advanceTimersByTime(51));
      expect(result.current.label).toBeNull();
    });

    it('correctly isolates no-face carry to HOLD_MS_VALID (150ms)', () => {
      vi.useFakeTimers();

      const sadResult: InferenceResult = { ...emptyResult(), status: 'valid', label: 'sad' };
      const { result, rerender } = renderHook(
        ({ frame, enabled }) => useFaceDisplay(frame, enabled),
        { initialProps: { frame: sadResult, enabled: true } },
      );
      expect(result.current).toEqual({ label: 'sad', carrying: false });

      // No-face frame
      rerender({ frame: emptyResult('no-face'), enabled: true });
      expect(result.current).toEqual({ label: 'sad', carrying: true });

      // At 140ms: still carrying
      act(() => vi.advanceTimersByTime(140));
      expect(result.current).toEqual({ label: 'sad', carrying: true });

      // At 151ms: expired cleanly
      act(() => vi.advanceTimersByTime(11));
      expect(result.current.label).toBeNull();
    });
  });

  describe('Attack Vector 5: Robustness Against Boundary & Corrupted Inputs', () => {
    it('gracefully handles non-monotonic timestamps, NaNs, and malformed score arrays', () => {
      const gate = new PredictionGate(defaultSettings);

      // Normal valid frame at t=100
      gate.update(makeResult(100, 1, 0.95));

      // Non-monotonic frame (t=50 < lastFrame 100)
      const backward = gate.update(makeResult(50, 1, 0.95));
      expect(backward.result.status).toBe('uncertain');
      expect(backward.result.decisionReason).toBe('invalid-input');
      expect(backward.trigger).toBeNull();

      // NaN in score array
      const nanResult: InferenceResult = {
        ...makeResult(200, 1),
        scores: [NaN, 0.5, 0.1, 0.1, 0.1, 0.1, 0.05, 0.05],
      };
      const nanOutput = gate.update(nanResult);
      expect(nanOutput.result.decisionReason).toBe('invalid-input');
      expect(nanOutput.trigger).toBeNull();

      // Wrong scores length (7 instead of 8)
      const shortResult: InferenceResult = {
        ...makeResult(300, 1),
        scores: [0.9, 0.02, 0.02, 0.02, 0.02, 0.01, 0.01],
      };
      const shortOutput = gate.update(shortResult);
      expect(shortOutput.result.decisionReason).toBe('invalid-input');
      expect(shortOutput.trigger).toBeNull();
    });

    it('reset() clears lastDisplayEmitted and candidate state completely', () => {
      const gate = new PredictionGate(defaultSettings);

      // Establish happy emission
      gate.update(makeResult(0, 1, 0.98));
      const f120 = gate.update(makeResult(120, 1, 0.98));
      expect(f120.result.label).toBe('happy');

      // Reset
      gate.reset();
      expect(gate.candidateTimestamp()).toBeNull();

      // New frame after reset at t=0 must start fresh as stabilizing
      const afterReset = gate.update(makeResult(0, 1, 0.98));
      expect(afterReset.result.label).toBeNull();
      expect(afterReset.result.decisionReason).toBe('stabilizing');
    });

    it('enforces 400ms haptic floor even when base dwellMs is configured to minimum (100ms)', () => {
      // Configure dwellMs = 100ms (minimum allowed by schema)
      const aggressiveGate = new PredictionGate({ ...defaultSettings, dwellMs: 100 });

      // Margin 0.96 -> effectiveDwellMs = 100 * 0.6 = 60ms
      aggressiveGate.update(makeResult(0, 1, 0.98));
      const f60 = aggressiveGate.update(makeResult(60, 1, 0.98));

      // Display emits at 60ms!
      expect(f60.result.label).toBe('happy');
      // But haptic trigger MUST STILL BE NULL!
      expect(f60.trigger).toBeNull();

      // Check intermediary steps: 100ms, 200ms, 300ms, 399ms
      for (const t of [100, 200, 300, 399]) {
        const step = aggressiveGate.update(makeResult(t, 1, 0.98));
        expect(step.result.label).toBe('happy');
        expect(step.trigger).toBeNull();
      }

      // At exactly 400ms: trigger fires
      const f400 = aggressiveGate.update(makeResult(400, 1, 0.98));
      expect(f400.trigger).toBe('happy');
    });

    it('useFaceDisplay handles missing scores, all zeros, and rapid enabled toggling without crashing', () => {
      vi.useFakeTimers();

      const { result, rerender } = renderHook(
        ({ frame, enabled }: { frame: InferenceResult; enabled: boolean }) =>
          useFaceDisplay(frame, enabled),
        {
          initialProps: {
            frame: { ...emptyResult('uncertain'), scores: [] as number[] },
            enabled: true,
          },
        },
      );
      expect(result.current).toEqual({ label: null, carrying: false });

      // Frame with all zero scores
      rerender({
        frame: {
          ...emptyResult('uncertain'),
          scores: [0, 0, 0, 0, 0, 0, 0, 0],
          decisionReason: 'stabilizing',
        },
        enabled: true,
      });
      expect(result.current).toEqual({ label: null, carrying: false });

      // Rapidly toggle enabled off and on
      rerender({
        frame: { ...emptyResult(), status: 'valid', label: 'happy' },
        enabled: false,
      });
      expect(result.current).toEqual({ label: null, carrying: false });

      rerender({
        frame: { ...emptyResult(), status: 'valid', label: 'happy' },
        enabled: true,
      });
      expect(result.current).toEqual({ label: 'happy', carrying: false });
    });
  });
});
