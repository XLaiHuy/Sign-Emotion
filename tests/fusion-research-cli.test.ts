import { expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

it('calibrates pairs fairly and blocks repeat held-out evaluation and participant leakage', async () => {
  const root = await mkdtemp(join(tmpdir(), 'signemo-fusion-'));
  const input = join(root, 'input.json'),
    output = join(root, 'report.json');
  const labels = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'fear', 'disgust'];
  const now = Date.now();
  const dataset = {
    schemaVersion: 1,
    encryptedStorageConfirmed: true,
    researchConsent: true,
    license: 'Synthetic only',
    rows: ['validation', 'test'].flatMap((split) =>
      labels.map((label, index) => ({
        participantId: split,
        sessionId: split,
        split,
        reference: label,
        consentedAt: new Date(now - 1000).toISOString(),
        expiresAt: new Date(now + 86400000).toISOString(),
        rightsVerified: true,
        segment: { id: `${split}-${index}`, startMs: index * 5000, endMs: index * 5000 + 2000 },
        decidedAtMs: index * 5000 + 2100,
        evidence: ['face', 'text', 'voice'].map((source) => ({
          source,
          startMs: index * 5000,
          endMs: index * 5000 + 2000,
          scores: { [label]: 0.8 },
          unsupportedScore: 0.2,
          quality: 'usable',
          modelVersion: 'synthetic',
        })),
      })),
    ),
  };
  const run = () =>
    spawnSync(process.execPath, [resolve('scripts/evaluate-fusion.mjs'), input, output], {
      encoding: 'utf8',
    });
  try {
    await writeFile(input, JSON.stringify(dataset));
    expect(run().status).toBe(0);
    const report = JSON.parse(await readFile(output, 'utf8'));
    expect(report.calibratedPairs).toHaveLength(3);
    expect(report.validationQualityPassed).toBe(false);
    expect(report.promotionAllowed).toBe(false);
    expect(report.validation.perClass.fear.support).toBe(1);
    expect(report.validation.perClass.disgust.support).toBe(1);
    expect(await readFile(output, 'utf8')).not.toContain('participantId');
    expect(run().stderr).toContain('Held-out report already exists');
    await rm(output);
    dataset.rows[labels.length].participantId = 'validation';
    await writeFile(input, JSON.stringify(dataset));
    expect(run().stderr).toContain('Participant leakage');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
