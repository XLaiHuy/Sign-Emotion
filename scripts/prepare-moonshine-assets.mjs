import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';

const lock = JSON.parse(await readFile('scripts/moonshine-streaming-vi.lock.json', 'utf8'));
const destination = resolve('public/models/moonshine/tiny-streaming-vi');
const runtimeDestination = resolve('public/runtime/moonshine');
const licensePath = resolve('public/licenses/moonshine-MIT.txt');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const limitBytes = 100 * 1024 * 1024;

if (
  lock.version !== 'moonshine-streaming-tiny-vi@quantized_26_08_24' ||
  lock.runtimePackage !== '@moonshine-ai/moonshine-wasm' ||
  lock.runtimeVersion !== '0.1.5' ||
  lock.license !== 'MIT'
)
  throw new Error('Moonshine research profile identity is not pinned');

const assets = [];
for (const pinned of lock.assets) {
  const target = resolve(destination, pinned.file);
  await mkdir(dirname(target), { recursive: true });
  let bytes;
  try {
    bytes = await readFile(target);
  } catch {
    /* Download on a clean checkout. */
  }
  if (!bytes || bytes.length !== pinned.bytes || hash(bytes) !== pinned.sha256) {
    console.log(`Preparing Moonshine research asset: ${pinned.file}`);
    const response = await fetch(new URL(pinned.file, lock.sourceBase), {
      signal: AbortSignal.timeout(300_000),
    });
    if (!response.ok) throw new Error(`Moonshine asset HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== pinned.bytes || hash(bytes) !== pinned.sha256)
      throw new Error(`Moonshine checksum mismatch: ${pinned.file}`);
    const temporary = `${target}.tmp`;
    await writeFile(temporary, bytes);
    const verified = await readFile(temporary);
    if (verified.length !== pinned.bytes || hash(verified) !== pinned.sha256)
      throw new Error(`Moonshine asset write verification failed: ${pinned.file}`);
    await writeFile(target, verified);
    await rm(temporary, { force: true });
  }
  assets.push({
    file: pinned.file,
    url: `/models/moonshine/tiny-streaming-vi/${pinned.file}`,
    bytes: pinned.bytes,
    sha256: pinned.sha256,
    source: new URL(pinned.file, lock.sourceBase).href,
    license: lock.license,
  });
}

const runtimePackage = JSON.parse(
  await readFile(resolve('node_modules/@moonshine-ai/moonshine-wasm/package.json'), 'utf8'),
);
if (runtimePackage.version !== lock.runtimeVersion || runtimePackage.license !== lock.license)
  throw new Error('Installed Moonshine WASM runtime differs from the pinned lock');
await mkdir(runtimeDestination, { recursive: true });
let runtimeBytes = 0;
let archive;
for (const pinned of lock.runtimeAssets) {
  const target = resolve(runtimeDestination, pinned.file);
  let bytes = await readFile(target).catch(() => undefined);
  if (!bytes || bytes.length !== pinned.bytes || hash(bytes) !== pinned.sha256) {
    if (!archive) {
      const response = await fetch(lock.runtimeRelease.url, {
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) throw new Error('Moonshine release download failed');
      const compressed = Buffer.from(await response.arrayBuffer());
      if (
        compressed.length !== lock.runtimeRelease.bytes ||
        hash(compressed) !== lock.runtimeRelease.sha256
      )
        throw new Error('Moonshine release archive checksum mismatch');
      archive = gunzipSync(compressed);
    }
    // Read only two fixed regular-file members; never extract archive paths to disk.
    for (let offset = 0; offset + 512 <= archive.length;) {
      const header = archive.subarray(offset, offset + 512);
      const name = header.subarray(0, 100).toString().replace(/\0.*$/s, '');
      const size =
        parseInt(header.subarray(124, 136).toString().replace(/\0.*$/s, '').trim(), 8) || 0;
      if (!Number.isSafeInteger(size) || size < 0 || offset + 512 + size > archive.length)
        throw new Error('Invalid Moonshine release member');
      if (name === `dist/${pinned.file}` && [0, 48].includes(header[156])) {
        bytes = archive.subarray(offset + 512, offset + 512 + size);
        break;
      }
      offset += 512 + Math.ceil(size / 512) * 512;
    }
  }
  if (!bytes) throw new Error('Moonshine release member missing');
  if (bytes.length !== pinned.bytes || hash(bytes) !== pinned.sha256)
    throw new Error(`Moonshine runtime checksum mismatch: ${pinned.file}`);
  await writeFile(target, bytes);
  runtimeBytes += bytes.length;
}
const modelBytes = assets.reduce((sum, asset) => sum + asset.bytes, 0);
const totalBytes = modelBytes + runtimeBytes;
if (totalBytes > limitBytes)
  throw new Error(`Moonshine profile exceeds 100 MiB including runtime (${totalBytes} bytes)`);

let license;
try {
  license = await readFile(licensePath);
} catch {
  const response = await fetch(
    'https://raw.githubusercontent.com/moonshine-ai/moonshine/v0.1.5/LICENSE',
    { signal: AbortSignal.timeout(30_000) },
  );
  if (!response.ok) throw new Error('Could not prepare the pinned Moonshine MIT license');
  license = Buffer.from(await response.arrayBuffer());
  await mkdir(dirname(licensePath), { recursive: true });
  await writeFile(licensePath, license);
}
if (hash(license) !== 'fa7d1174dd8af6a7cd280be20b80d10095ed4c19b5b20b61a7715c3ad790dc5f')
  throw new Error('Moonshine license text differs from v0.1.5');

const manifest = {
  version: lock.version,
  language: 'Vietnamese',
  architecture: 'tiny-streaming',
  runtime: {
    package: lock.runtimePackage,
    version: lock.runtimeVersion,
    release: lock.runtimeRelease,
    files: lock.runtimeAssets.map((asset) => ({
      file: asset.file,
      url: `/runtime/moonshine/${asset.file}`,
      bytes: asset.bytes,
      sha256: asset.sha256,
    })),
    bytes: runtimeBytes,
  },
  license: lock.license,
  licenseFile: '/licenses/moonshine-MIT.txt',
  sourceRevision: lock.sourceRevision,
  modelBytes,
  totalBytes,
  maxBytes: limitBytes,
  assets,
};
await writeFile(
  resolve('public/models/moonshine/manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
console.log(
  `Prepared pinned Moonshine profile: ${(modelBytes / 1048576).toFixed(1)} MiB model + ${(runtimeBytes / 1048576).toFixed(1)} MiB runtime = ${(totalBytes / 1048576).toFixed(1)} MiB`,
);
