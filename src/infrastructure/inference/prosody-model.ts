import { z } from 'zod';
import * as ort from 'onnxruntime-web/wasm';
import { PROSODY_FEATURES, PROSODY_VERSION, type ProsodySummary } from '../../domain/prosody';
import type { ModalityEvidence } from '../../domain/conversation';
import type { SpeechAudioQuality } from '../../domain/audio';
import { mapEmotionScores } from './emotion-provider';
export const prosodyManifestSchema = z
  .object({
    version: z.string().min(1).max(100),
    featureVersion: z.literal(PROSODY_VERSION),
    features: z
      .array(z.string())
      .length(PROSODY_FEATURES.length)
      .refine((items) => items.every((item, i) => item === PROSODY_FEATURES[i])),
    labels: z
      .array(z.enum(['neutral', 'happy', 'sad', 'angry', 'surprised', 'other', 'fear', 'disgust']))
      .min(2)
      .max(8)
      .refine((items) => new Set(items).size === items.length),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    bytes: z
      .number()
      .int()
      .positive()
      .max(5 * 1048576),
    license: z.string().min(1).max(200),
    source: z.string().min(1).max(500),
    researchOnly: z.literal(true),
    participantDisjoint: z.literal(true),
    precision: z.literal('float32'),
    runtime: z.literal('onnxruntime-web-wasm'),
    preprocessing: z.literal('standardization-and-temperature-in-graph'),
  })
  .strict();
export interface ProsodyArtifact {
  manifest: z.infer<typeof prosodyManifestSchema>;
  bytes: ArrayBuffer;
}
export async function readProsodyArtifact(
  manifestFile: File,
  modelFile: File,
): Promise<ProsodyArtifact> {
  if (manifestFile.size > 32 * 1024 || modelFile.size > 5 * 1048576)
    throw new Error('Gói tone nghiên cứu quá lớn.');
  const manifest = prosodyManifestSchema.parse(JSON.parse(await manifestFile.text()));
  const bytes = await modelFile.arrayBuffer();
  const sha = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
  if (manifest.sha256 !== sha || manifest.bytes !== bytes.byteLength)
    throw new Error('Checksum model tone không khớp.');
  return { manifest, bytes };
}
export class ProsodyProvider {
  private session: ort.InferenceSession | null = null;
  constructor(private artifact: ProsodyArtifact) {}
  async prepare() {
    this.artifact.manifest = prosodyManifestSchema.parse(this.artifact.manifest);
    const digest = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', this.artifact.bytes)),
    )
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
    if (
      this.artifact.bytes.byteLength !== this.artifact.manifest.bytes ||
      digest !== this.artifact.manifest.sha256
    )
      throw new Error('Tone model checksum mismatch');
    ort.env.wasm.wasmPaths = '/runtime/ort/';
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    this.session = await ort.InferenceSession.create(this.artifact.bytes, {
      executionProviders: ['wasm'],
    });
    if (
      this.session.inputNames.length !== 1 ||
      this.session.inputNames[0] !== 'features' ||
      this.session.outputNames[0] !== 'logits'
    ) {
      await this.dispose();
      throw new Error('Tone model contract mismatch');
    }
  }
  async infer(
    summary: ProsodySummary | undefined,
    startMs: number,
    endMs: number,
    quality?: SpeechAudioQuality,
  ): Promise<ModalityEvidence> {
    const base = {
      source: 'voice' as const,
      startMs,
      endMs,
      modelVersion: this.artifact.manifest.version,
    };
    const valid =
      summary?.version === PROSODY_VERSION &&
      summary.features.length === PROSODY_FEATURES.length &&
      summary.features.every(Number.isFinite) &&
      summary.frames >= 25 &&
      summary.durationMs <= 9500 &&
      quality &&
      quality.noiseMeasured !== false &&
      quality.speechRms >= 0.005 &&
      quality.clippingRatio < 0.05 &&
      quality.speechRms / Math.max(quality.noiseRms, 0.002) >= 1.5;
    if (!valid || !this.session)
      return {
        ...base,
        scores: {},
        unsupportedScore: 1,
        quality: 'rejected',
        reason: 'poor-audio',
      };
    const input = new ort.Tensor('float32', Float32Array.from(summary.features), [
      1,
      PROSODY_FEATURES.length,
    ]);
    let output: ort.InferenceSession.ReturnType | undefined;
    try {
      output = await this.session.run({ features: input });
      return {
        ...base,
        ...mapEmotionScores(output.logits.data as Float32Array, this.artifact.manifest.labels),
        quality: 'usable',
      };
    } finally {
      input.dispose();
      if (output) Object.values(output).forEach((tensor) => tensor.dispose());
    }
  }
  async dispose() {
    await this.session?.release();
    this.session = null;
  }
}
