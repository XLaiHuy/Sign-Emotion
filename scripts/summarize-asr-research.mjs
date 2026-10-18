import { readFile, writeFile } from 'node:fs/promises';
import { normalizeTranscript, speechError } from '../src/domain/speechMetrics.ts';
const file = process.argv[2] ?? 'output/research-evaluation/asr-browser-smoke.json';
const report = JSON.parse(await readFile(file, 'utf8'));
const profiles = ['phowhisper', 'gipformer-research'].map((profile) => {
  const rows = report.results.filter((row) => row.profile === profile && !row.failed);
  const metrics = rows.map((row) => speechError(row.reference, row.segment.text));
  const sum = (key) => metrics.reduce((value, item) => value + item[key], 0);
  const times = rows.map((row) => row.segment.processingMs).sort((a, b) => a - b);
  return {
    profile,
    samples: rows.length,
    wer: sum('wordErrors') / Math.max(1, sum('referenceWords')),
    cer: sum('charErrors') / Math.max(1, sum('referenceChars')),
    rtf:
      rows.reduce((sum, row) => sum + row.segment.processingMs, 0) /
      Math.max(
        1,
        rows.reduce((sum, row) => sum + row.seconds * 1000, 0),
      ),
    fullClipDecodeP50Ms: times[Math.ceil(times.length * 0.5) - 1],
    fullClipDecodeP95Ms: times[Math.ceil(times.length * 0.95) - 1],
    preparationMs: rows[0]?.preparationMs,
    pythonRawMatches:
      profile === 'gipformer-research'
        ? rows.filter((row) => row.segment.text === row.pythonText).length
        : null,
    pythonNormalizedMatches:
      profile === 'gipformer-research'
        ? rows.filter(
            (row) => normalizeTranscript(row.segment.text) === normalizeTranscript(row.pythonText),
          ).length
        : null,
  };
});
const summary = {
  dataset: report.dataset,
  license: report.license,
  browser: report.browser,
  profiles,
  windows: report.windows,
  nonLocalOrWriteRequests: report.nonLocalOrWriteRequests,
  scope: report.scope,
  promotionAllowed: false,
  missingGates: [
    'speaker-disjoint conversational validation/test',
    '30-minute full pipeline',
    'physical microphone',
    'RAM peak',
    'noise/region coverage',
  ],
};
await writeFile(
  'output/research-evaluation/asr-summary.json',
  JSON.stringify(summary, null, 2) + '\n',
);
console.log(JSON.stringify(summary, null, 2));
