import { InferenceClient, seekVideo } from './videoInference';
import { PredictionGate } from '../../domain/face/prediction';
import { evaluateRows, type EvaluationRow, type Segment } from '../../domain/evaluation';
import { timingSummary } from '../../domain/benchmark';
import type { CalibrationProfile, Settings } from '../../shared/contracts';
import { faceProfileContract, type FaceModelProfile } from './face-model-profile';
import { conversationProfile } from './conversationProfile';

export const faceComparisonProfiles: FaceModelProfile[] = [
  'b0-wasm-research',
  'b0-webgpu-research',
  'b2-webgpu-research',
];
export function selectedFaceComparisonProfiles(profile = conversationProfile().id) {
  return profile === 'pc-candidate'
    ? faceComparisonProfiles.filter((item) => item !== 'b2-webgpu-research')
    : faceComparisonProfiles;
}
export interface FaceComparisonResult {
  profile: FaceModelProfile;
  modelVersion: string;
  modelSha256: string;
  backend: 'wasm' | 'webgpu';
  status: 'ok' | 'unavailable';
  samples: number;
  coldMs?: number;
  captureToResult?: ReturnType<typeof timingSummary>;
  detection?: ReturnType<typeof timingSummary>;
  crop?: ReturnType<typeof timingSummary>;
  classifier?: ReturnType<typeof timingSummary>;
  quality?: ReturnType<typeof evaluateRows> | null;
}
/** Same media timestamps and settings for every profile. Only one worker exists at a time. */
export async function compareVideoFaces(
  video: HTMLVideoElement,
  duration: number,
  settings: Settings,
  calibration: CalibrationProfile | undefined,
  segments: Segment[],
  signal: AbortSignal,
  own: (client: InferenceClient | null) => void,
  progress: (profile: FaceModelProfile, percent: number) => void,
) {
  const count = Math.ceil(Math.min(duration, 30) * 5);
  if (!Number.isFinite(count) || count < 1 || count > 150) throw new Error('Invalid duration');
  const reports: FaceComparisonResult[] = [];
  for (const profile of selectedFaceComparisonProfiles()) {
    signal.throwIfAborted();
    const contract = faceProfileContract(profile);
    const metadata = {
      profile,
      modelVersion: contract.version,
      modelSha256: contract.sha256,
      backend: contract.backend,
    };
    let engine: InferenceClient | undefined;
    const abort = () => engine?.close();
    signal.addEventListener('abort', abort, { once: true });
    const rows: EvaluationRow[] = [],
      times: number[] = [],
      detection: number[] = [],
      crop: number[] = [],
      classifier: number[] = [];
    try {
      engine = new InferenceClient(undefined, true, profile);
      own(engine);
      await engine.ready;
      const gate = new PredictionGate(settings, calibration);
      for (let i = 0; i < count; i++) {
        signal.throwIfAborted();
        const timeMs = i * 200;
        await seekVideo(video, Math.min(timeMs / 1000, Math.max(0, duration - 0.001)), signal);
        const started = performance.now();
        const input = await engine.infer(video, timeMs);
        signal.throwIfAborted();
        const gated = gate.update(input);
        times.push(performance.now() - started);
        if (input.stages) {
          detection.push(input.stages.detectionMs);
          // Zero means this stage was skipped, not a fast classification.
          if (input.stages.cropMs > 0) crop.push(input.stages.cropMs);
          if (input.stages.classifierMs > 0) classifier.push(input.stages.classifierMs);
        }
        rows.push({
          timeMs,
          rawScores: input.scores,
          smoothedScores: gated.result.scores,
          predicted: gated.result.label ?? 'uncertain',
          status: gated.result.status,
          reason: gated.result.qualityReason ?? gated.result.decisionReason ?? '',
          processingMs: input.processingMs,
          trigger: gated.trigger,
        });
        progress(profile, Math.round(((i + 1) / count) * 100));
      }
      const quality = evaluateRows(rows, segments);
      reports.push({
        ...metadata,
        status: 'ok',
        samples: rows.length,
        coldMs: times[0],
        captureToResult: timingSummary(times.slice(1)),
        detection: timingSummary(detection),
        crop: timingSummary(crop),
        classifier: timingSummary(classifier),
        quality: quality.labeledSamples ? quality : null,
      });
    } catch {
      signal.throwIfAborted();
      reports.push({ ...metadata, status: 'unavailable', samples: rows.length });
    } finally {
      signal.removeEventListener('abort', abort);
      engine?.close();
      own(null);
    }
  }
  return reports;
}
