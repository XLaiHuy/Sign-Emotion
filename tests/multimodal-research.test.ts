import { expect, it } from 'vitest';
import {
  baselineFusion,
  fuse,
  FusionRhythmGate,
  speechFusionCandidates,
  type ModalityEvidence,
} from '../src/domain/conversation';
import { AsrWorkload } from '../src/domain/asr';
import { SpeechContext } from '../src/domain/speechContext';
import { UtteranceBuilder, estimateFileAudioQuality } from '../src/domain/audio';
import { extractProsody, PROSODY_FEATURES, ProsodyAccumulator } from '../src/domain/prosody';
import { prosodyManifestSchema } from '../src/infrastructure/inference/prosody-model';

it('does not invent a noise floor for continuous audio without a quiet interval', () => {
  const steady = new Float32Array(16000).fill(0.1);
  expect(estimateFileAudioQuality(steady).noiseMeasured).toBe(false);
  steady.fill(0, 0, 8000);
  expect(estimateFileAudioQuality(steady).noiseMeasured).toBe(true);
});

const segment = {
  id: 'final',
  startMs: 1000,
  endMs: 3000,
  text: 'Tôi đang buồn',
  processingMs: 50,
  finalizedAtMs: 3050,
  modelVersion: 'test',
};
const item = (source: ModalityEvidence['source'], label = 'sad'): ModalityEvidence => ({
  source,
  segmentId: segment.id,
  startMs: 1000,
  endMs: 3000,
  scores: { [label]: 0.9 },
  unsupportedScore: 0.1,
  quality: 'usable',
  modelVersion: 'test',
});

it('keeps voice out of the product baseline, and compares explicit three-source research profiles', () => {
  expect(fuse(segment, [item('text'), item('voice')], baselineFusion).label).toBeNull();
  const profile = speechFusionCandidates[1];
  expect(profile.validated).toBe(false);
  expect(profile.weights).toEqual({ face: 0.2, text: 0.4, voice: 0.4 });
  expect(fuse(segment, [item('text'), item('voice')], profile).label).toBe('sad');
  expect(fuse(segment, [item('text'), item('voice'), item('face', 'angry')], profile).reason).toBe(
    'conflict',
  );
  expect(
    fuse(segment, [item('face'), { ...item('text'), segmentId: 'old' }], profile).label,
  ).toBeNull();
  expect(
    fuse(segment, [item('face'), { ...item('voice'), quality: 'rejected' }], profile).label,
  ).toBeNull();
});
it('rejects late cues and does not emit again for a revision or recalculation of the same segment', () => {
  const decision = fuse(segment, [item('face'), item('text')]);
  const gate = new FusionRhythmGate();
  expect(gate.update(decision, 3100, 3000, 3000)).toBe('sad');
  expect(gate.update({ ...decision, label: 'angry' }, 7000, 3000, 3000)).toBeNull();
  expect(gate.update({ ...decision, segmentId: 'late' }, 7000, 3000, 3000)).toBeNull();
});
it('counts overlapping partial decodes as work without counting the same audio twice or including gaps', () => {
  const load = new AsrWorkload();
  load.observe({ startMs: 0, endMs: 800 }, 400);
  expect(load.observe({ startMs: 0, endMs: 1600 }, 400)).toBeCloseTo(0.5);
  expect(load.observe({ startMs: 0, endMs: 3000 }, 400)).toBeCloseTo(0.4);
  expect(load.observe({ startMs: 10000, endMs: 11000 }, 400)).toBeCloseTo(0.4);
  expect(load.canRunContext(1)).toBe(false);
});
it('preserves utterance identity across forced cuts but does not analyze a truncated sentence as complete', () => {
  const builder = new UtteranceBuilder(true);
  const frame = new Float32Array(512).fill(0.05);
  let cut = null;
  for (let i = 0; i < 94; i++) cut = builder.push(frame, 0.9, i * 512) ?? cut;
  expect(cut?.boundary).toBe('limit');
  for (let i = 94; i < 120; i++) builder.push(frame, 0.9, i * 512);
  const final = builder.flush()!;
  expect(final.utteranceId).toBe(cut?.utteranceId);
  expect(final.prosody!.frames).toBe(120);
  const context = new SpeechContext();
  expect(
    context.accept({
      ...segment,
      id: 'first',
      utteranceId: 'one',
      boundary: 'limit',
      text: 'Tôi không',
    }),
  ).toBeNull();
  expect(
    context.accept({ ...segment, utteranceId: 'one', boundary: 'silence', text: 'thấy buồn' })
      ?.text,
  ).toBe('Tôi không thấy buồn');
  for (let i = 0; i < 3; i++)
    context.accept({ ...segment, id: String(i), utteranceId: 'long', boundary: 'limit' });
  expect(context.accept({ ...segment, utteranceId: 'long', boundary: 'silence' })).toBeNull();
  context.reset();
  expect(context.accept(segment)?.text).toBe(segment.text);
});
it('extracts finite spectral/prosody features with exact offline/chunk parity, including silence', () => {
  const samples = Float32Array.from(
    { length: 16000 },
    (_, i) => 0.1 * Math.sin((2 * Math.PI * 180 * i) / 16000),
  );
  const summary = extractProsody(samples);
  expect(summary.features).toHaveLength(PROSODY_FEATURES.length);
  expect(summary.features.every(Number.isFinite)).toBe(true);
  const accumulator = new ProsodyAccumulator();
  for (let i = 0; i + 512 <= samples.length; i += 512)
    accumulator.push(samples.subarray(i, i + 512));
  expect(accumulator.summary()).toEqual(summary);
  const silence = extractProsody(new Float32Array(16000));
  expect(silence.features[34]).toBe(0);
  expect(silence.features.every(Number.isFinite)).toBe(true);
  expect(() => accumulator.push(new Float32Array([NaN]))).toThrow();
});
it('requires explicit research manifests, exact feature order and the five-MiB tone budget', () => {
  const manifest = {
    version: 'test',
    featureVersion: 'mel16-prosody-v1',
    features: PROSODY_FEATURES,
    labels: ['neutral', 'sad'],
    sha256: '0'.repeat(64),
    bytes: 100,
    license: 'private',
    source: 'consented data',
    researchOnly: true,
    participantDisjoint: true,
    precision: 'float32',
    runtime: 'onnxruntime-web-wasm',
    preprocessing: 'standardization-and-temperature-in-graph',
  };
  expect(prosodyManifestSchema.safeParse(manifest).success).toBe(true);
  expect(prosodyManifestSchema.safeParse({ ...manifest, researchOnly: false }).success).toBe(false);
  expect(
    prosodyManifestSchema.safeParse({ ...manifest, features: [...PROSODY_FEATURES].reverse() })
      .success,
  ).toBe(false);
  expect(prosodyManifestSchema.safeParse({ ...manifest, bytes: 6 * 1048576 }).success).toBe(false);
});
