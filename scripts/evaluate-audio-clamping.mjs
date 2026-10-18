// Offline A/B reference harness; never imports into the app or promotes a profile.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createServer } from 'vite';
import { clampTail, score } from './audio-clamping-metrics.mjs';

const root = resolve('.');
const out = join(root, 'output/research-evaluation/audio-clamping');
await mkdir(out, { recursive: true });
const metadata = JSON.parse(await readFile('output/evaluation/fleurs-samples.json', 'utf8'));
if (
  metadata.dataset !== 'google/fleurs' ||
  metadata.config !== 'vi_vn' ||
  metadata.license !== 'CC-BY-4.0' ||
  metadata.samples.length !== 5
)
  throw new Error('Exactly five licensed Vietnamese FLEURS fixtures required');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const samples = [];
for (const [index, sample] of metadata.samples.entries()) {
  const path = resolve(sample.path);
  if (digest(await readFile(path)) !== sample.sha256) throw new Error('Fixture checksum mismatch');
  samples.push({
    ...sample,
    path,
    pcm: join(out, `${index}.f32`),
    scores: join(out, `${index}-vad.json`),
  });
}
const jobPath = join(out, 'job.json');
const python = process.env.SIGNEMO_RESEARCH_PYTHON ?? join(root, '.venv/Scripts/python.exe');
function run(mode) {
  const result = spawnSync(python, ['scripts/audio-clamping-reference.py', mode, jobPath], {
    encoding: 'utf8',
    timeout: 600_000,
  });
  if (result.status !== 0)
    throw new Error(
      `Local ${mode} reference failed; inspect local dependencies (no automatic downloads)`,
    );
}
const server = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, entries: [] },
  server: { middlewareMode: true, watch: null },
  appType: 'custom',
});
try {
  const { GIPFORMER_MANIFEST } = await server.ssrLoadModule(
    '/src/infrastructure/inference/gipformer-assets.ts',
  );
  for (const item of GIPFORMER_MANIFEST.assets.filter((asset) =>
    /\.onnx$|tokens\.txt$/.test(asset.file),
  )) {
    const bytes = await readFile(join(root, 'output/research-assets/gipformer', item.file));
    if (bytes.length !== item.size || digest(bytes) !== item.sha256)
      throw new Error('Model checksum mismatch');
  }
  const conversation = JSON.parse(
    await readFile('public/models/conversation-manifest.json', 'utf8'),
  );
  const vad = conversation.packs
    .flatMap((pack) => pack.assets)
    .find((item) => item.url.endsWith('/silero_vad.onnx'));
  if (!vad || digest(await readFile(join(root, 'public', vad.url))) !== vad.sha256)
    throw new Error('VAD checksum mismatch');
  await writeFile(jobPath, JSON.stringify({ samples }));
  run('vad');
  const { UtteranceBuilder } = await server.ssrLoadModule('/src/domain/audio.ts');
  const segments = [],
    boundaries = [];
  for (const [id, sample] of samples.entries()) {
    const bytes = await readFile(sample.pcm);
    const pcm = new Float32Array(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    const probabilities = JSON.parse(await readFile(sample.scores, 'utf8'));
    const builder = new UtteranceBuilder();
    const chunks = [];
    for (let offset = 0; offset < pcm.length; offset += 512) {
      const frame = new Float32Array(512);
      frame.set(pcm.subarray(offset, offset + 512));
      const chunk = builder.push(frame, probabilities[offset / 512], offset);
      if (chunk) chunks.push(chunk);
    }
    const tail = builder.flush();
    if (tail) chunks.push(tail);
    for (const [index, chunk] of chunks.entries()) {
      // Estimate background from non-speech frames outside the tested tail.
      // Production quality.noiseRms uses recent trailing frames, so reusing it
      // here would make the test's floor circular.
      const noise = [];
      for (let offset = chunk.startSample; offset + 512 <= chunk.endSample - 3200; offset += 512) {
        if (probabilities[offset / 512] >= 0.5) continue;
        const frame = pcm.subarray(offset, Math.min(offset + 512, pcm.length));
        if (frame.length !== 512) continue;
        noise.push(Math.sqrt(frame.reduce((sum, value) => sum + value * value, 0) / 512));
      }
      noise.sort((a, b) => a - b);
      const candidate = clampTail(
        chunk.samples,
        noise[Math.floor(noise.length / 2)] ?? 0,
        noise.length > 0,
      );
      boundaries.push({
        id,
        index,
        startSample: chunk.startSample,
        endSample: chunk.endSample,
        boundary: chunk.boundary,
        applied: candidate.applied,
        tailRms: candidate.rms,
        threshold: candidate.threshold,
        independentNoiseFrames: noise.length,
      });
      // Alternate paired order across chunks to avoid always warming only B.
      for (const variant of index % 2 ? ['B', 'A'] : ['A', 'B']) {
        const values = variant === 'A' ? chunk.samples : candidate.samples;
        const path = join(out, `${id}-${index}-${variant}.f32`);
        await writeFile(path, new Uint8Array(values.buffer, values.byteOffset, values.byteLength));
        segments.push({ id, index, variant, pcm: path });
      }
    }
  }
  const results = join(out, 'reference-results.json');
  await writeFile(jobPath, JSON.stringify({ segments, results }));
  run('decode');
  const referenceResult = JSON.parse(await readFile(results, 'utf8'));
  const decoded = referenceResult.segments;
  const rows = samples.map((sample, id) => {
    const variants = Object.fromEntries(
      ['A', 'B'].map((variant) => {
        const parts = decoded
          .filter((row) => row.id === id && row.variant === variant)
          .sort((a, b) => a.index - b.index);
        return [
          variant,
          {
            ...score(sample.reference, parts.map((part) => part.text).join(' ')),
            processingMs: parts.reduce((sum, part) => sum + part.ms, 0),
          },
        ];
      }),
    );
    return {
      id,
      sha256: sample.sha256,
      seconds: sample.seconds,
      chunks: boundaries.filter((row) => row.id === id),
      ...variants,
    };
  });
  const aggregate = Object.fromEntries(
    ['A', 'B'].map((variant) => {
      const total = rows.reduce(
        (sum, row) => {
          for (const key of Object.keys(sum)) sum[key] += row[variant][key];
          return sum;
        },
        {
          errors: 0,
          deletions: 0,
          insertions: 0,
          tailDeletions: 0,
          referenceWords: 0,
          charErrors: 0,
          referenceChars: 0,
          processingMs: 0,
        },
      );
      return [
        variant,
        {
          ...total,
          wer: total.errors / total.referenceWords,
          cer: total.charErrors / total.referenceChars,
          deletionRate: total.deletions / total.referenceWords,
        },
      ];
    }),
  );
  const report = {
    createdAt: new Date().toISOString(),
    status: 'research-only',
    dataset: metadata.dataset,
    split: metadata.split,
    license: metadata.license,
    model: GIPFORMER_MANIFEST.profile,
    referenceRuntime: referenceResult.runtime,
    vadSha256: vad.sha256,
    productionChanged: false,
    promotionPassed: false,
    noClipTailDeletionIncrease: rows.every((row) => row.B.tailDeletions <= row.A.tailDeletions),
    noClipDeletionIncrease: rows.every((row) => row.B.deletions <= row.A.deletions),
    scope:
      'Python CPU reference ASR with actual TypeScript UtteranceBuilder boundaries and Silero recurrent VAD. No browser latency, mic, dialect or accuracy generalization. No deduplication/rewrite of hypotheses.',
    tailMetric:
      'Levenshtein deletions among last three words of each complete reference clip, not word-timestamp-aligned segment tails. Tail hallucination requires manual annotation; insertion count alone is insufficient.',
    clamp: {
      milliseconds: 200,
      threshold:
        'min(0.01, 1.5 * median non-speech-frame RMS outside tested tail); no measured floor => disabled',
    },
    aggregate,
    samples: rows,
  };
  await writeFile(join(out, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      status: report.status,
      clips: rows.length,
      chunks: boundaries.length,
      clamped: boundaries.filter((row) => row.applied).length,
      aggregate,
      promotionPassed: false,
    }),
  );
} finally {
  await server.close();
}
