import { z } from 'zod';
// MediaPipe category names, not positional assumptions about result ordering.
export const FEATURE_NAMES = [
  '_neutral',
  'browDownLeft',
  'browDownRight',
  'browInnerUp',
  'browOuterUpLeft',
  'browOuterUpRight',
  'cheekPuff',
  'cheekSquintLeft',
  'cheekSquintRight',
  'eyeBlinkLeft',
  'eyeBlinkRight',
  'eyeLookDownLeft',
  'eyeLookDownRight',
  'eyeLookInLeft',
  'eyeLookInRight',
  'eyeLookOutLeft',
  'eyeLookOutRight',
  'eyeLookUpLeft',
  'eyeLookUpRight',
  'eyeSquintLeft',
  'eyeSquintRight',
  'eyeWideLeft',
  'eyeWideRight',
  'jawForward',
  'jawLeft',
  'jawOpen',
  'jawRight',
  'mouthClose',
  'mouthDimpleLeft',
  'mouthDimpleRight',
  'mouthFrownLeft',
  'mouthFrownRight',
  'mouthFunnel',
  'mouthLeft',
  'mouthLowerDownLeft',
  'mouthLowerDownRight',
  'mouthPressLeft',
  'mouthPressRight',
  'mouthPucker',
  'mouthRight',
  'mouthRollLower',
  'mouthRollUpper',
  'mouthShrugLower',
  'mouthShrugUpper',
  'mouthSmileLeft',
  'mouthSmileRight',
  'mouthStretchLeft',
  'mouthStretchRight',
  'mouthUpperUpLeft',
  'mouthUpperUpRight',
  'noseSneerLeft',
  'noseSneerRight',
] as const;
export const DETECTOR_SHA256 = '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff';
export const auxiliaryManifestSchema = z
  .object({
    version: z.string().min(1).max(40),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    bytes: z.number().int().positive().max(5_000_000),
    featureNames: z.array(z.string()).length(52),
    detectorSha256: z.literal(DETECTOR_SHA256),
    labels: z.tuple([z.literal('neutral'), z.literal('sad')]),
    preprocessing: z.literal('standardization-in-graph'),
    threshold: z.number().min(0.5).max(0.99),
    margin: z.number().min(0).max(1),
    approved: z.boolean(),
    source: z.string().min(1),
    license: z.string().min(1),
    evaluation: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .refine(
    (m) => m.featureNames.every((n, i) => n === FEATURE_NAMES[i]),
    'Thứ tự đặc trưng không khớp',
  )
  .refine(
    (m) =>
      !m.approved ||
      (m.evaluation?.testEvaluated === true &&
        m.evaluation?.validationPassed === true &&
        m.evaluation?.sufficientCoverage === true),
    'Gói chưa có đủ bằng chứng đánh giá để bật camera',
  );
export type AuxiliaryManifest = z.infer<typeof auxiliaryManifestSchema>;
export interface AuxiliaryArtifact {
  manifest: AuxiliaryManifest;
  bytes: ArrayBuffer;
}
export async function readAuxiliary(
  manifestFile: File,
  modelFile: File,
): Promise<AuxiliaryArtifact> {
  if (manifestFile.size > 100_000 || modelFile.size > 5_000_000)
    throw new Error('Gói model phụ quá lớn');
  const manifest = auxiliaryManifestSchema.parse(JSON.parse(await manifestFile.text()));
  const bytes = await modelFile.arrayBuffer();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (v) =>
    v.toString(16).padStart(2, '0'),
  ).join('');
  if (bytes.byteLength !== manifest.bytes || hash !== manifest.sha256)
    throw new Error('Model phụ không khớp checksum');
  return { manifest, bytes };
}
