import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';

const revision = 'dd9227dcd8705c13f33bdbe59728d546ab94480f';
const source = 'https://huggingface.co/g-group-ai-lab/gipformer1.5-68M-rnnt';
const destination = resolve('output/research-assets/gipformer');
const temporary = resolve('output/research-deps/gipformer');
await mkdir(destination, { recursive: true });
await mkdir(temporary, { recursive: true });
const hash = (bytes, algorithm = 'sha256', encoding = 'hex') =>
  createHash(algorithm).update(bytes).digest(encoding);
async function fetchPinned(url, expected, algorithm = 'sha256', encoding = 'hex', existing) {
  let bytes;
  if (existing) {
    try {
      bytes = await readFile(existing);
    } catch {
      /* first preparation */
    }
  }
  if (!bytes || hash(bytes, algorithm, encoding) !== expected) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status} while preparing research assets`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  if (hash(bytes, algorithm, encoding) !== expected)
    throw new Error('Research asset checksum mismatch');
  return bytes;
}
const integrity =
  'bsZ7K55hNakFbCVIrCsuwEFLLiWa/1/KI6dXEK3CwtI6N/j/Zc1LMheo1syMJhG0e4gu7MXPwbtKfbm44BQYIg==';
const tarball = join(temporary, 'sherpa-onnx-1.13.8.tgz');
await writeFile(
  tarball,
  await fetchPinned(
    'https://registry.npmjs.org/sherpa-onnx/-/sherpa-onnx-1.13.8.tgz',
    integrity,
    'sha512',
    'base64',
    tarball,
  ),
);
execFileSync('tar', ['-xzf', 'sherpa-onnx-1.13.8.tgz'], { cwd: temporary });
const packageDir = join(temporary, 'package');
let loader = await readFile(join(packageDir, 'sherpa-onnx-wasm-nodejs.js'), 'utf8');
const wrapper = await readFile(join(packageDir, 'sherpa-onnx-asr.js'), 'utf8');
const loaderEnd = loader.lastIndexOf('if(typeof exports===');
const wrapperEnd = wrapper.lastIndexOf("if (typeof process == 'object'");
if (loaderEnd < 0 || wrapperEnd < 0) throw new Error('Pinned runtime layout changed');
// The npm build uses NODERAWFS. Retain its compiled MEMFS implementation in a
// browser worker instead; the original WASM bytes are never modified.
const rawStart = loader.indexOf('if(!ENVIRONMENT_IS_NODE){throw new Error("NODERAWFS');
const rawEnd = loader.indexOf('{if(Module["noExitRuntime"])', rawStart);
if (rawStart < 0 || rawEnd < 0 || !loader.includes('var nodePath=require("path");'))
  throw new Error('Pinned filesystem layout changed');
loader = loader.slice(0, rawStart) + loader.slice(rawEnd);
loader = loader.replace('var nodePath=require("path");', 'var nodePath=browserPosixPath;');
loader = loader.replace(';return moduleRtn', ';Module["FS"]=FS;return moduleRtn');
const pathAdapter = `const browserPosixPath={
  isAbsolute:p=>p.startsWith('/'),
  normalize:p=>{const absolute=p.startsWith('/'),parts=[];for(const item of p.split('/')){if(!item||item==='.')continue;if(item==='..'&&parts.length&&parts.at(-1)!=='..')parts.pop();else if(item==='..'){if(!absolute)parts.push(item)}else parts.push(item)}return(absolute?'/':'')+parts.join('/')||(absolute?'/':'.')},
  dirname:p=>{if(p==='/')return '/';p=p.replace(/\\/+$/,'');const i=p.lastIndexOf('/');return i<0?'.':i===0?'/':p.slice(0,i)},
  basename:p=>p.replace(/\\/+$/,'').split('/').at(-1),
  join:(...p)=>browserPosixPath.normalize(p.join('/'))
};
browserPosixPath.posix=browserPosixPath;
browserPosixPath.resolve=(...parts)=>{let path='/';for(const p of parts){if(!p)continue;path=p.startsWith('/')?p:path+'/'+p}return browserPosixPath.normalize(path)};
browserPosixPath.relative=(from,to)=>{const a=browserPosixPath.resolve(from).split('/').filter(Boolean),b=browserPosixPath.resolve(to).split('/').filter(Boolean);let i=0;while(i<a.length&&a[i]===b[i])i++;return [...a.slice(i).map(()=>'..'),...b.slice(i)].join('/')};\n`;
await writeFile(
  join(destination, 'sherpa.mjs'),
  pathAdapter +
    loader.slice(0, loader.lastIndexOf('if(typeof exports===')) +
    '\nexport default Module;\n',
);
await writeFile(
  join(destination, 'asr.mjs'),
  wrapper.slice(0, wrapperEnd) + '\nexport { OfflineRecognizer };\n',
);
await copyFile(join(packageDir, 'sherpa-onnx-wasm-nodejs.wasm'), join(destination, 'sherpa.wasm'));
const weights = {
  'encoder.int8.onnx': 'b528768939c7711a889be81a718ea7f2ee50d0d2d384d53f399e15b44bd9408c',
  'decoder.int8.onnx': 'e0a156b5454722a524230f9e35d5d928cfcdd3723437b418e5bd5e04f1c3a101',
  'joiner.int8.onnx': '12636559d135315f002a1e1b477077d415e888477378db0fd450aee5b21ac551',
  'tokens.txt': 'f536d03c2e95ebd2930cf0abec88e823bd17d3c1933da7ae6a82db3b80605e15',
};
for (const [file, checksum] of Object.entries(weights)) {
  const target = join(destination, file);
  await writeFile(
    target,
    await fetchPinned(`${source}/resolve/${revision}/${file}`, checksum, 'sha256', 'hex', target),
  );
  console.log(`Verified ${file}`);
}
const assets = await Promise.all(
  [...Object.keys(weights), 'sherpa.mjs', 'asr.mjs', 'sherpa.wasm'].map(async (file) => {
    const bytes = await readFile(join(destination, file));
    return { file, size: bytes.length, sha256: hash(bytes) };
  }),
);
const bytes = assets.reduce((sum, asset) => sum + asset.size, 0);
if (bytes > 100 * 1048576)
  throw new Error('Research ASR profile exceeds 100 MiB including runtime');
await writeFile(
  join(destination, 'manifest.json'),
  JSON.stringify(
    {
      profile: 'gipformer1.5-int8@sherpa-1.13.8',
      researchOnly: true,
      validated: false,
      source,
      revision,
      license: 'MIT (model card)',
      runtime: {
        package: 'sherpa-onnx',
        version: '1.13.8',
        license: 'Apache-2.0',
        integrity: `sha512-${integrity}`,
        browserAdaptation:
          'ESM exports, browser POSIX paths, MEMFS instead of Node-only NODERAWFS; unchanged WASM',
      },
      preprocessing: {
        sampleRate: 16000,
        channels: 1,
        featureDim: 80,
        decoder: 'greedy_search',
        statefulStreaming: false,
      },
      assets,
      bytes,
    },
    null,
    2,
  ) + '\n',
);
await writeFile(
  join(destination, 'NOTICE.txt'),
  `Gipformer model: ${source}/tree/${revision}, MIT per model card.\nRuntime: sherpa-onnx 1.13.8, Apache-2.0, https://github.com/k2-fsa/sherpa-onnx/tree/v1.13.8\nCompatibility patch: ES module exports, POSIX paths and MEMFS instead of Node-only NODERAWFS; unchanged binary WASM. Original package is pinned by SHA-512, adapted files by SHA-256.\nResearch only: no production accuracy/latency claim.\n`,
);
console.log(
  `Research profile: ${(bytes / 1048576).toFixed(2)} MiB including WASM. Not included in production image.`,
);
