import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const metadata = JSON.parse(await readFile('output/evaluation/fleurs-samples.json', 'utf8'));
const template = await readFile('scripts/browser-speech-check.js', 'utf8');
await mkdir('output/playwright', { recursive: true });
await writeFile(
  'output/evaluation/browser-run.js',
  template.replace('__SAMPLES__', JSON.stringify(metadata.samples)).trim().replace(/;$/, ''),
);
const npm = process.env.npm_execpath;
if (!npm)
  throw new Error(
    'Run through npm run speech:evaluate (Playwright CLI session signemo-pc, speech lab open).',
  );
const result = spawnSync(
  process.execPath,
  [
    npm,
    'exec',
    '--yes',
    '--package',
    '@playwright/cli',
    '--',
    'playwright-cli',
    '-s=signemo-pc',
    'run-code',
    '--filename',
    'output/evaluation/browser-run.js',
  ],
  { encoding: 'utf8', timeout: 900_000 },
);
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
await writeFile('output/evaluation/browser-log.txt', (result.stdout ?? '') + (result.stderr ?? ''));
if (result.status !== 0) process.exit(result.status ?? 1);
const reports = await Promise.all(
  metadata.samples.map((sample) =>
    readFile(`output/evaluation/result-${sample.row}.json`, 'utf8').then(JSON.parse),
  ),
);
const totals = reports.reduce(
  (sum, report) => ({
    wordErrors: sum.wordErrors + report.metrics.wordErrors,
    referenceWords: sum.referenceWords + report.metrics.referenceWords,
    charErrors: sum.charErrors + report.metrics.charErrors,
    referenceChars: sum.referenceChars + report.metrics.referenceChars,
    seconds: sum.seconds + report.seconds,
    processingMs: sum.processingMs + report.segment.processingMs,
  }),
  {
    wordErrors: 0,
    referenceWords: 0,
    charErrors: 0,
    referenceChars: 0,
    seconds: 0,
    processingMs: 0,
  },
);
const summary = {
  dataset: metadata.dataset,
  config: metadata.config,
  split: metadata.split,
  license: metadata.license,
  samples: reports.length,
  ...totals,
  wer: totals.wordErrors / totals.referenceWords,
  cer: totals.charErrors / totals.referenceChars,
  rtf: totals.processingMs / (totals.seconds * 1000),
  scope:
    'PC browser local-file smoke test; no physical microphone, emotion accuracy, dialect coverage or Android verification',
};
await writeFile('output/evaluation/summary.json', JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
