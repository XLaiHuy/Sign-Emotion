import {
  type CalibrationProfile,
  type DecisionReason,
  type Expression,
  type InferenceResult,
  type Settings,
  MODEL_VERSION,
  faceScoreLabels,
} from '../../shared/contracts';

const labels = faceScoreLabels;
/** Experimental display-only timing. The haptic floor stays at 400 ms. */
export function effectiveDwellMs(baseMs: number, margin: number) {
  return baseMs * (margin >= 0.35 ? 0.6 : margin >= 0.2 ? 1 : 1.6);
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
  private lastHaptic = -Infinity;
  private auxiliaryEma: number[] | null = null;
  constructor(
    private settings: Settings,
    private profile?: CalibrationProfile,
  ) {}
  configure(settings: Settings) {
    this.settings = settings;
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
    let decision = classify(this.ema, this.settings.threshold, this.profile);
    const winner = this.ema.indexOf(Math.max(...this.ema));
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
    if (candidateAge < effectiveDwellMs(this.settings.dwellMs, decision.margin ?? 0))
      return {
        result: { ...result, label: null, status: 'uncertain', decisionReason: 'stabilizing' },
        trigger: null,
      };
    if (decision.label === 'neutral') {
      this.lastEmitted = 'neutral';
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
          : this.lastEmitted === decision.label
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
