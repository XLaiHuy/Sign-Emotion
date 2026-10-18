import type { Expression } from '../shared/contracts';

/** Modalities produced by the current product pipeline. */
export type Modality = 'face' | 'text' | 'voice';
/** Kept only so encrypted conversations written by earlier builds remain readable. */
export type LegacyModality = Modality;
export interface TranscriptSegment {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  /** Original ASR string, present only when a constrained display revision was applied. */
  rawText?: string;
  revision?: number;
  modelVersion: string;
  processingMs: number;
  finalizedAtMs: number;
  boundary?: 'silence' | 'limit' | 'finish';
  utteranceId?: string;
}
/** Temporary live ASR text. It is UI-only until a final segment is accepted. */
export interface ProvisionalCaption {
  id: string;
  revision: number;
  startMs: number;
  endMs: number;
  text: string;
  state: 'interim' | 'unclear';
}
export interface ModalityEvidence {
  source: Modality;
  startMs: number;
  endMs: number;
  scores: Partial<Record<Expression, number>>;
  unsupportedScore: number;
  quality: 'usable' | 'rejected';
  /** Reduced-quality face observations use less weight and a stricter margin. */
  reliability?: 'reduced';
  reason?: string;
  modelVersion: string;
  segmentId?: string;
}
/** Strict interval overlap; adjacent intervals and invalid clocks never agree. */
export function temporalIoU(
  a: { startMs: number; endMs: number },
  b: { startMs: number; endMs: number },
) {
  if (
    ![a.startMs, a.endMs, b.startMs, b.endMs].every(Number.isFinite) ||
    a.endMs <= a.startMs ||
    b.endMs <= b.startMs
  )
    return 0;
  const overlap = Math.max(0, Math.min(a.endMs, b.endMs) - Math.max(a.startMs, b.startMs));
  return overlap / (Math.max(a.endMs, b.endMs) - Math.min(a.startMs, b.startMs));
}
export interface FusionDecision {
  segmentId: string;
  label: Expression | null;
  score: number;
  contributors: LegacyModality[];
  reason: 'agreement' | 'missing-evidence' | 'conflict' | 'low-score';
  experimental: boolean;
  configVersion: string;
}
export interface ConversationRecord {
  id: string;
  createdAt: string;
  segments: TranscriptSegment[];
  decisions: FusionDecision[];
}
export interface FusionProfile {
  version: string;
  validated: boolean;
  weights: Partial<Record<Modality, number>>;
  thresholds: Partial<Record<Modality, number>>;
  margin: number;
}
export const baselineFusion: FusionProfile = {
  version: 'face-text-quality-demo-v4',
  validated: false,
  weights: { face: 1, text: 1, voice: 0 },
  thresholds: { face: 0.55, text: 0.55, voice: 0.65 },
  margin: 0.1,
};

export const toneFusion: FusionProfile = {
  ...baselineFusion,
  version: 'face-text-voice-quality-demo-v2',
  weights: { face: 1, text: 1, voice: 1 },
  thresholds: { ...baselineFusion.thresholds, voice: 0.65 },
};

/** Research configurations only. No voice profile is promoted by choosing weights. */
export const speechFusionCandidates: FusionProfile[] = [
  { face: 1, text: 1, voice: 1 },
  { face: 0.2, text: 0.4, voice: 0.4 },
  { face: 0.2, text: 0.5, voice: 0.3 },
  { face: 0.2, text: 0.3, voice: 0.5 },
].map((weights, index) => ({
  ...baselineFusion,
  version: `face-text-voice-research-v1-${index}`,
  weights,
}));

// Only evidence from the same utterance contributes. Unsupported probability
// mass is retained: dropping it and renormalizing would manufacture certainty.
export function fuse(
  segment: Pick<TranscriptSegment, 'id' | 'startMs' | 'endMs'>,
  evidence: ModalityEvidence[],
  profile: FusionProfile = baselineFusion,
): FusionDecision {
  const decision: FusionDecision = {
    segmentId: segment.id,
    label: null,
    score: 0,
    contributors: [],
    reason: 'missing-evidence',
    experimental: !profile.validated,
    configVersion: profile.version,
  };
  const unique = new Map<Modality, ModalityEvidence>();
  for (const item of evidence) {
    const values = Object.values(item.scores);
    if (
      item.quality !== 'usable' ||
      (item.segmentId !== undefined && item.segmentId !== segment.id) ||
      !Number.isFinite(item.startMs) ||
      !Number.isFinite(item.endMs) ||
      item.endMs <= item.startMs ||
      item.startMs > segment.endMs ||
      item.endMs < segment.startMs ||
      (item.source === 'face' && temporalIoU(segment, item) < 0.4) ||
      !Number.isFinite(item.unsupportedScore) ||
      item.unsupportedScore < 0 ||
      item.unsupportedScore > 1 ||
      !values.length ||
      values.some((p) => !Number.isFinite(p) || p < 0 || p > 1) ||
      values.reduce((a, b) => a + b, 0) + item.unsupportedScore > 1.001 ||
      !((profile.weights[item.source] ?? 0) > 0)
    )
      continue;
    unique.set(item.source, item);
  }
  const votes = [...unique.values()].flatMap((item) => {
    const sorted = Object.entries(item.scores).sort((a, b) => b[1] - a[1]) as [
      Expression,
      number,
    ][];
    const [label, score] = sorted[0];
    const runnerUp = Math.max(sorted[1]?.[1] ?? 0, item.unsupportedScore);
    const margin =
      item.source === 'face' && item.reliability === 'reduced'
        ? Math.max(0.25, profile.margin)
        : profile.margin;
    return score >= (profile.thresholds[item.source] ?? 0.65) && score - runnerUp >= margin
      ? [{ item, label }]
      : [];
  });
  if (votes.length < 2)
    return { ...decision, reason: unique.size >= 2 ? 'low-score' : 'missing-evidence' };
  decision.contributors = votes.map((v) => v.item.source);
  if (new Set(votes.map((v) => v.label)).size > 1) return { ...decision, reason: 'conflict' };
  const label = votes[0].label;
  const voteWeight = (item: ModalityEvidence) =>
    (profile.weights[item.source] ?? 0) *
    (item.source === 'face' && item.reliability === 'reduced' ? 0.3 : 1);
  const weight = votes.reduce((sum, v) => sum + voteWeight(v.item), 0);
  const score =
    votes.reduce((sum, v) => sum + voteWeight(v.item) * (v.item.scores[label] ?? 0), 0) / weight;
  return { ...decision, label, score, reason: 'agreement' };
}

export class FusionRhythmGate {
  private seen = new Set<string>();
  private held: Expression | null = null;
  private last = -Infinity;
  update(
    decision: FusionDecision,
    now: number,
    cooldownMs = 3000,
    speechEndedAtMs?: number,
  ): Expression | null {
    if (this.seen.has(decision.segmentId)) return null;
    this.seen.add(decision.segmentId);
    if (this.seen.size > 500) this.seen.delete(this.seen.values().next().value!);
    if (
      speechEndedAtMs !== undefined &&
      (!Number.isFinite(speechEndedAtMs) || now < speechEndedAtMs || now - speechEndedAtMs > 3000)
    )
      return null;
    if (!decision.label) return null;
    if (decision.label === 'neutral') {
      this.held = 'neutral';
      return null;
    }
    if (decision.label === this.held || now - this.last < cooldownMs) return null;
    this.held = decision.label;
    this.last = now;
    return decision.label;
  }
}

/** Reduce face sampling when speech is queued or on-device inference is falling behind. */
export class FaceInferenceBudget {
  private level: 0 | 1 | 2 = 0;
  private healthySince: number | null = null;
  private pressureSince: number | null = null;

  update(
    nowMs: number,
    pendingAsr: number,
    rtf: number,
    faceServiceMs: number,
    oldestFinalWaitMs = 0,
  ) {
    const interval = [200, 500, 1000][this.level];
    const overloaded =
      pendingAsr >= 2 || oldestFinalWaitMs >= 1000 || faceServiceMs > interval * 0.9;
    if (overloaded) {
      this.pressureSince ??= nowMs;
      if (nowMs - this.pressureSince >= 2000) {
        this.level = Math.min(2, this.level + 1) as 0 | 1 | 2;
        this.pressureSince = nowMs;
      }
      this.healthySince = null;
    } else if (pendingAsr === 0 && rtf < 0.6 && faceServiceMs < [200, 200, 500][this.level] * 0.8) {
      this.pressureSince = null;
      this.healthySince ??= nowMs;
      if (nowMs - this.healthySince >= 10_000) {
        this.level = Math.max(0, this.level - 1) as 0 | 1 | 2;
        this.healthySince = nowMs;
      }
    } else {
      this.pressureSince = null;
      this.healthySince = null;
    }
    return [200, 500, 1000][this.level];
  }
}
