// CLI-first browser verification. Usage: node scripts/browser-responsive-check.js [local URL]
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const target = new URL(process.argv[2] ?? 'http://127.0.0.1:8089/');
if (!['127.0.0.1', 'localhost'].includes(target.hostname)) throw new Error('Local QA only');
const npx = join(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js');
if (!existsSync(npx)) throw new Error('Cannot find npx beside Node.js');
const run = (...args) => {
  const result = spawnSync(
    process.execPath,
    [
      npx,
      '--offline',
      '--package',
      '@playwright/cli',
      'playwright-cli',
      '-s=responsive-check',
      ...args,
    ],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) throw new Error('Browser CLI failed');
};
try {
  mkdirSync('output/playwright', { recursive: true });
  writeFileSync(
    'output/playwright/responsive-scenario.js',
    readFileSync('scripts/browser-responsive-scenario.js', 'utf8').trim().replace(/;$/, ''),
  );
  run('open', target.href, '--browser', 'msedge', '--headed');
  run('run-code', '--filename', 'output/playwright/responsive-scenario.js');
  const report = JSON.parse(readFileSync('output/playwright/responsive-report.json', 'utf8'));
  if (!report.passed) process.exitCode = 1;
} finally {
  run('close');
}
