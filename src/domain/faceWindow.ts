import { temporalIoU, type ModalityEvidence, type TranscriptSegment } from './conversation';
import { faceScoreLabels, type InferenceResult } from '../shared/contracts';

/** Aggregate only face observations that fall inside the same utterance window. */
export class FaceWindow {
  private frames: InferenceResult[] = [];
  private validAfterMs = -Infinity;

  add(result: InferenceResult) {
    if (result.timestamp < this.validAfterMs) return;
    this.frames.push(result);
    this.frames = this.frames.filter((frame) => frame.timestamp >= result.timestamp - 30_000);
  }

  reset(validAfterMs: number) {
    this.frames = [];
    this.validAfterMs = validAfterMs;
  }

  evidence(segment: TranscriptSegment): ModalityEvidence | null {
    // Never combine observations from before a camera or media-clock reset.
    if (segment.startMs < this.validAfterMs) return null;
    const all = this.frames.filter(
      (frame) => frame.timestamp >= segment.startMs && frame.timestamp <= segment.endMs,
    );
    const valid = all.filter(
      (frame) =>
        (frame.observationUsable ?? frame.status === 'valid') &&
        !frame.qualityReason &&
        frame.decisionReason !== 'stale-result' &&
        (frame.rawScores ?? frame.scores).length === faceScoreLabels.length &&
        (frame.rawScores ?? frame.scores).every(
          (score) => Number.isFinite(score) && score >= 0 && score <= 1,
        ),
    );
    if (
      valid.length < 2 ||
      valid.length / Math.max(1, all.length) < 0.6 ||
      valid.at(-1)!.timestamp - valid[0].timestamp < 500
    )
      return null;
    if (valid.some((frame) => frame.modelVersion !== valid[0].modelVersion)) return null;
    // Use observed support, not the entire speech interval as fabricated coverage.
    const support = { startMs: valid[0].timestamp, endMs: valid.at(-1)!.timestamp };
    if (temporalIoU(segment, support) < 0.4) return null;

    const scores: ModalityEvidence['scores'] = {};
    faceScoreLabels.forEach((label, index) => {
      if (label)
        scores[label] =
          valid.reduce((sum, frame) => sum + (frame.rawScores ?? frame.scores)[index], 0) /
          valid.length;
    });
    const unsupportedScore =
      valid.reduce(
        (sum, frame) =>
          sum +
          faceScoreLabels.reduce(
            (mass, label, index) => mass + (label ? 0 : (frame.rawScores ?? frame.scores)[index]),
            0,
          ),
        0,
      ) / valid.length;
    return {
      source: 'face',
      startMs: support.startMs,
      endMs: support.endMs,
      scores,
      unsupportedScore,
      quality: 'usable',
      ...(valid.some((frame) => frame.qualityWarning) ? { reliability: 'reduced' as const } : {}),
      modelVersion: valid[0].modelVersion,
    };
  }
}
