import {
  type CalibrationProfile,
  type DecisionReason,
  type Expression,
  type InferenceResult,
  type Settings,
  MODEL_VERSION,
  defaultSettings,
  faceScoreLabels,
} from '../../shared/contracts';

const labels = faceScoreLabels;
/** Experimental display-only timing. The haptic floor stays at 400 ms. */
export function effectiveDwellMs(baseMs: number, margin: number) {
  return baseMs * (margin >= 0.35 ? 0.6 : margin >= 0.2 ? 1 : 1.6);
}
export function defaultFaceCalibration(
  baseThreshold = defaultSettings.threshold,
): CalibrationProfile {
  const scale = baseThreshold / 0.55;
  const clamp = (value: number) =>
    Math.min(0.95, Math.max(0.22, Number((value * scale).toFixed(3))));
  return {
    thresholds: {
      neutral: clamp(0.28),
      happy: clamp(0.38),
      surprised: clamp(0.42),
      angry: clamp(0.42),
      sad: clamp(0.35),
      fear: clamp(0.34),
      disgust: clamp(0.34),
    },
    margins: {
      neutral: 0.02,
      happy: 0.05,
      surprised: 0.06,
      angry: 0.06,
      sad: 0.04,
      fear: 0.04,
      disgust: 0.04,
    },
  };
}
export interface BlendshapeCategory {
  categoryName: string;
  score: number;
}
/** Bounded in-RAM geometric prior from MediaPipe ARKit blendshapes. Never persisted or logged. */
export function applyBlendshapePrior(
  scores: readonly number[],
  categories?: readonly BlendshapeCategory[],
): number[] {
  if (
    scores.length !== 8 ||
    scores.some((v) => !Number.isFinite(v) || v < 0 || v > 1) ||
    !categories?.length
  )
    return [...scores];
  if (scores[7] >= 0.7) return [...scores];

  const map = new Map<string, number>();
  for (const item of categories) {
    if (Number.isFinite(item.score) && item.score >= 0 && item.score <= 1) {
      map.set(item.categoryName, item.score);
    }
  }
  const get = (name: string) => map.get(name) ?? 0;
  const pair = (left: string, right: string) => 0.5 * (get(left) + get(right));

  const smile = pair('mouthSmileLeft', 'mouthSmileRight');
  const cheekSquint = pair('cheekSquintLeft', 'cheekSquintRight');
  const dimple = pair('mouthDimpleLeft', 'mouthDimpleRight');
  const frown = pair('mouthFrownLeft', 'mouthFrownRight');
  const browInnerUp = get('browInnerUp');
  const browDown = pair('browDownLeft', 'browDownRight');
  const eyeWide = pair('eyeWideLeft', 'eyeWideRight');
  const eyeSquint = pair('eyeSquintLeft', 'eyeSquintRight');
  const mouthStretch = pair('mouthStretchLeft', 'mouthStretchRight');
  const jawOpen = get('jawOpen');
  const noseSneer = pair('noseSneerLeft', 'noseSneerRight');
  const upperLip = pair('mouthUpperUpLeft', 'mouthUpperUpRight');
  const shrugLower = get('mouthShrugLower');
  const mouthPress = pair('mouthPressLeft', 'mouthPressRight');

  const adjusted = [...scores];

  const happySignal = smile + 0.45 * cheekSquint + 0.25 * dimple;
  if ((smile >= 0.2 || happySignal >= 0.26) && frown < 0.25 && noseSneer < 0.25) {
    const boost = 0.24 * Math.min(1, happySignal / 0.5);
    adjusted[1] += boost;
    adjusted[0] = Math.max(0.01, adjusted[0] - boost * 0.45);
    adjusted[7] = Math.max(0.005, adjusted[7] * 0.45);
  }

  const sadBrow = eyeWide < 0.22 && jawOpen < 0.22 ? 0.55 * browInnerUp : 0;
  const sadSignal = Math.max(frown, 0.75 * shrugLower) + sadBrow + 0.3 * mouthPress;
  if (sadSignal >= 0.18 && smile < 0.2 && noseSneer < 0.22) {
    const boost = 0.24 * Math.min(1, sadSignal / 0.42);
    adjusted[3] += boost;
    adjusted[0] = Math.max(0.01, adjusted[0] - boost * 0.5);
    adjusted[7] = Math.max(0.005, adjusted[7] * 0.55);
  }

  const fearSignal = 0.45 * eyeWide + 0.45 * browInnerUp + 0.55 * mouthStretch + 0.2 * jawOpen;
  if (
    smile < 0.2 &&
    ((eyeWide >= 0.16 && (browInnerUp >= 0.18 || mouthStretch >= 0.16)) ||
      (browInnerUp >= 0.24 && mouthStretch >= 0.18))
  ) {
    const boost = 0.24 * Math.min(1, fearSignal / 0.45);
    adjusted[6] += boost;
    adjusted[2] = Math.max(0.01, adjusted[2] - boost * 0.35);
    adjusted[0] = Math.max(0.01, adjusted[0] - boost * 0.35);
  }

  const disgustSignal = 0.65 * noseSneer + 0.55 * upperLip + 0.35 * browDown + 0.25 * eyeSquint;
  if (
    smile < 0.22 &&
    (noseSneer >= 0.12 ||
      upperLip >= 0.14 ||
      (browDown >= 0.22 && (noseSneer >= 0.06 || upperLip >= 0.08 || eyeSquint >= 0.25)))
  ) {
    const boost = 0.25 * Math.min(1, disgustSignal / 0.4);
    adjusted[5] += boost;
    adjusted[0] = Math.max(0.01, adjusted[0] - boost * 0.4);
    adjusted[4] = Math.max(0.01, adjusted[4] - boost * 0.25);
    adjusted[7] = Math.max(0.005, adjusted[7] * 0.5);
  }

  const total = adjusted.reduce((sum, v) => sum + Math.max(0, v), 0);
  return total > 0 ? adjusted.map((v) => Math.max(0, v) / total) : [...scores];
}
export function softmax(logits: ArrayLike<number>): number[] {
  const values = Array.from(logits);
  if (values.length !== 8 || values.some((v) => !Number.isFinite(v)))
    throw new Error('Đầu ra model không hợp lệ');
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp(v - max));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / total);
}
export function classify(
  scores: number[],
  threshold: number,
  profile?: CalibrationProfile,
): Pick<InferenceResult, 'label' | 'score' | 'status' | 'decisionReason' | 'margin'> {
  if (scores.length !== 8 || scores.some((v) => !Number.isFinite(v) || v < 0 || v > 1))
    return { label: null, score: 0, status: 'uncertain' };
  const best = scores.indexOf(Math.max(...scores));
  const label = labels[best];
  const margin = scores[best] - Math.max(...scores.filter((_, i) => i !== best));
  const decisionReason: DecisionReason | undefined = !label
    ? 'unsupported-class'
    : scores[best] < (profile?.thresholds[label] ?? threshold)
      ? 'low-score'
      : margin < (profile?.margins[label] ?? 0)
        ? 'small-margin'
        : undefined;
  if (
    decisionReason &&
    decisionReason !== 'unsupported-class' &&
    profile?.thresholds.neutral !== undefined &&
    scores[0] >= profile.thresholds.neutral &&
    scores[7] < 0.45
  ) {
    return {
      label: 'neutral',
      score: scores[0],
      status: 'valid',
      decisionReason: undefined,
      margin: Math.max(0, scores[0] - Math.max(...scores.slice(1))),
    };
  }
  return {
    label: decisionReason ? null : label,
    score: scores[best],
    status: decisionReason ? 'uncertain' : 'valid',
    decisionReason,
    margin,
  };
}
export class PredictionGate {
  private static readonly EMA_TIME_CONSTANT_MS = 150;
  private static readonly HAPTIC_DWELL_MS = 400;
  private ema: number[] | null = null;
  private candidate: Expression | null = null;
  private candidateSince = 0;
  private lastFrame = -Infinity;
  private lastEmitted: Expression | null = null;
  private lastDisplayEmitted: Expression | null = null;
  private lastHaptic = -Infinity;
  private auxiliaryEma: number[] | null = null;
  constructor(
    private settings: Settings,
    private profile?: CalibrationProfile,
  ) {}
  configure(settings: Settings, profile?: CalibrationProfile) {
    this.settings = settings;
    if (profile !== undefined) this.profile = profile;
    this.clear();
  }
  clear() {
    this.ema = null;
    this.auxiliaryEma = null;
    this.candidate = null;
    this.candidateSince = 0;
  }
  reset() {
    this.clear();
    this.lastEmitted = null;
    this.lastDisplayEmitted = null;
    this.lastHaptic = -Infinity;
    this.lastFrame = -Infinity;
  }
  candidateTimestamp() {
    return this.candidate ? this.candidateSince : null;
  }
  update(input: InferenceResult): { result: InferenceResult; trigger: Expression | null } {
    if (input.timestamp < this.lastFrame)
      return {
        result: { ...input, label: null, status: 'uncertain', decisionReason: 'invalid-input' },
        trigger: null,
      };
    const elapsedMs = Number.isFinite(this.lastFrame) ? input.timestamp - this.lastFrame : 0;
    this.lastFrame = input.timestamp;
    if (
      input.status !== 'valid' ||
      input.scores.length !== 8 ||
      input.scores.some((v) => !Number.isFinite(v) || v < 0 || v > 1)
    ) {
      this.clear();
      return { result: { ...input, label: null, decisionReason: 'invalid-input' }, trigger: null };
    }
    const alpha = this.ema
      ? 1 - Math.exp(-Math.max(0, elapsedMs) / PredictionGate.EMA_TIME_CONSTANT_MS)
      : 1;
    this.ema = this.ema
      ? input.scores.map((v, i) => alpha * v + (1 - alpha) * this.ema![i])
      : [...input.scores];
    const winner = this.ema.indexOf(Math.max(...this.ema));
    const heldLabel = this.candidate ?? this.lastDisplayEmitted ?? this.lastEmitted;
    const activeProfile =
      heldLabel && labels[winner] === heldLabel
        ? {
            thresholds: {
              ...this.profile?.thresholds,
              [heldLabel]: (this.profile?.thresholds[heldLabel] ?? this.settings.threshold) * 0.85,
            },
            margins: {
              ...this.profile?.margins,
              [heldLabel]: (this.profile?.margins[heldLabel] ?? 0) * 0.7,
            },
          }
        : this.profile;
    let decision = classify(this.ema, this.settings.threshold, activeProfile);
    const aux = input.auxiliary;
    if (aux && (winner === 0 || winner === 3)) {
      if (
        aux.scores.length !== 2 ||
        aux.scores.some((v) => !Number.isFinite(v) || v < 0 || v > 1)
      ) {
        decision = {
          label: null,
          score: 0,
          status: 'uncertain',
          decisionReason: 'auxiliary-uncertain',
        };
      } else {
        this.auxiliaryEma = this.auxiliaryEma
          ? aux.scores.map((v, i) => alpha * v + (1 - alpha) * this.auxiliaryEma![i])
          : [...aux.scores];
        const [neutral, sad] = this.auxiliaryEma,
          score = Math.max(neutral, sad),
          margin = Math.abs(sad - neutral);
        const valid = score >= aux.threshold && margin >= aux.margin;
        decision = {
          label: valid ? (sad > neutral ? 'sad' : 'neutral') : null,
          score,
          status: valid ? 'valid' : 'uncertain',
          margin,
          decisionReason: valid ? undefined : 'auxiliary-uncertain',
        };
      }
    } else this.auxiliaryEma = null;
    const result = { ...input, ...decision, rawScores: [...input.scores], scores: [...this.ema] };
    if (!decision.label) {
      this.candidate = null;
      return { result, trigger: null };
    }
    if (this.candidate !== decision.label) {
      this.candidate = decision.label;
      this.candidateSince = input.timestamp;
    }
    const candidateAge = input.timestamp - this.candidateSince;
    const rawDwell = effectiveDwellMs(this.settings.dwellMs, decision.margin ?? 0);
    const requiredDwell = this.profile
      ? decision.label === 'neutral' && (this.lastDisplayEmitted ?? this.lastEmitted) === null
        ? 0
        : Math.min(this.settings.dwellMs, rawDwell)
      : rawDwell;
    if (candidateAge < requiredDwell)
      return {
        result: { ...result, label: null, status: 'uncertain', decisionReason: 'stabilizing' },
        trigger: null,
      };
    this.lastDisplayEmitted = decision.label;
    if (decision.label === 'neutral') {
      this.lastEmitted = 'neutral';
      this.lastDisplayEmitted = 'neutral';
      return { result: { ...result, decisionReason: 'neutral' }, trigger: null };
    }
    const canTrigger =
      candidateAge >= PredictionGate.HAPTIC_DWELL_MS &&
      this.lastEmitted !== decision.label &&
      input.timestamp - this.lastHaptic >= this.settings.cooldownMs;
    if (canTrigger) {
      this.lastEmitted = decision.label;
      this.lastHaptic = input.timestamp;
    }
    return {
      result: {
        ...result,
        decisionReason: canTrigger
          ? 'stable-change'
          : this.lastEmitted === decision.label || this.lastDisplayEmitted === decision.label
            ? 'held-expression'
            : 'cooldown',
      },
      trigger: canTrigger ? decision.label : null,
    };
  }
}
export function emptyResult(status: InferenceResult['status'] = 'no-face'): InferenceResult {
  return {
    timestamp: performance.now(),
    label: null,
    score: 0,
    status,
    modelVersion: MODEL_VERSION,
    processingMs: 0,
    scores: [],
  };
}
export function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
}
