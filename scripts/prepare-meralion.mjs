import { createHash } from 'node:crypto';
import { createWriteStream, createReadStream } from 'node:fs';
import { mkdir, readFile, rename, stat, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
const lock = JSON.parse(await readFile('scripts/meralion-ser.lock.json', 'utf8'));
const target = 'output/research-models/meralion-ser';
if (!process.argv.includes('--download')) {
  console.log(
    'PC research only; explicit --download fetches 3.08 GB weights. Read the pinned upstream licence first. Never part of browser/Docker product.',
  );
  process.exit(0);
}
await mkdir(`${target}/whisper-config`, { recursive: true });
async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function download(name, url, sha) {
  const file = `${target}/${name}`;
  try {
    if ((await stat(file)).isFile() && (await digest(file)) === sha) return;
  } catch {
    /* fetch only this asset */
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(3600000) });
  if (!response.ok || !response.body) throw new Error(`Research artifact HTTP ${response.status}`);
  const temporary = `${file}.partial`;
  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
    if ((await digest(temporary)) !== sha) throw new Error('Research checksum mismatch');
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}
for (const [file, sha] of Object.entries(lock.files))
  await download(file, `${lock.source}/resolve/${lock.revision}/${file}`, sha);
await download('whisper-config/config.json', lock.whisperConfig.source, lock.whisperConfig.sha256);
console.log(
  'PC reference artifacts verified. No browser model, audio capture or inference was started.',
);
