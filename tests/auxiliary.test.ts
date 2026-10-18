import { expect, it } from 'vitest';
import {
  FEATURE_NAMES,
  DETECTOR_SHA256,
  auxiliaryManifestSchema,
} from '../src/infrastructure/inference/auxiliary';
it('rejects changed feature order and accidental camera approval without evaluation', () => {
  const manifest = {
    version: 'test',
    sha256: 'a'.repeat(64),
    bytes: 10,
    featureNames: [...FEATURE_NAMES],
    detectorSha256: DETECTOR_SHA256,
    labels: ['neutral', 'sad'],
    preprocessing: 'standardization-in-graph',
    threshold: 0.8,
    margin: 0.15,
    approved: false,
    source: 'synthetic test',
    license: 'test only',
  };
  expect(auxiliaryManifestSchema.safeParse(manifest).success).toBe(true);
  expect(
    auxiliaryManifestSchema.safeParse({ ...manifest, featureNames: [...FEATURE_NAMES].reverse() })
      .success,
  ).toBe(false);
  expect(auxiliaryManifestSchema.safeParse({ ...manifest, approved: true }).success).toBe(false);
});
