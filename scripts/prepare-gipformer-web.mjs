import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const revision = 'dd9227dcd8705c13f33bdbe59728d546ab94480f';
const source = 'https://huggingface.co/g-group-ai-lab/gipformer1.5-68M-rnnt';

const PINNED_ASSETS = [
  {
    file: 'encoder.int8.onnx',
    size: 70876359,
    sha256: 'b528768939c7711a889be81a718ea7f2ee50d0d2d384d53f399e15b44bd9408c',
  },
  {
    file: 'decoder.int8.onnx',
    size: 1308690,
    sha256: 'e0a156b5454722a524230f9e35d5d928cfcdd3723437b418e5bd5e04f1c3a101',
  },
  {
    file: 'joiner.int8.onnx',
    size: 1033417,
    sha256: '12636559d135315f002a1e1b477077d415e888477378db0fd450aee5b21ac551',
  },
  {
    file: 'tokens.txt',
    size: 25847,
    sha256: 'f536d03c2e95ebd2930cf0abec88e823bd17d3c1933da7ae6a82db3b80605e15',
  },
  {
    file: 'sherpa.mjs',
    size: 102774,
    sha256: 'ef7b6ba64e5f030b14f3c16ec36fee89f41a8f84615091ba7d237f0697f404c5',
  },
  {
    file: 'asr.mjs',
    size: 53698,
    sha256: '40a56e955a76829a050dbcf725504a1fdb1579c4ea0cfbef7228fe8355d4341b',
  },
  {
    file: 'sherpa.wasm',
    size: 15133706,
    sha256: 'a802c2e20151126789e24792b76cfc3ab9d9bda60bcd5c6a514f06eb35131a1a',
  },
];

const RUNTIME_FILES = ['sherpa.mjs', 'asr.mjs', 'sherpa.wasm'];

const hash = (bytes, algorithm = 'sha256', encoding = 'hex') =>
  createHash(algorithm).update(bytes).digest(encoding);

async function fileMatches(filePath, expectedSize, expectedSha256) {
  try {
    const bytes = await readFile(filePath);
    return bytes.length === expectedSize && hash(bytes) === expectedSha256;
  } catch {
    return false;
  }
}

export async function prepareGipformerWebRuntime(root = process.cwd()) {
  const destination = resolve(root, 'public/research/gipformer');
  const localResearchDir = resolve(root, 'output/research-assets/gipformer');
  const temporary = resolve(root, 'output/research-deps/gipformer');
  await mkdir(destination, { recursive: true });

  let allReady = true;
  for (const name of RUNTIME_FILES) {
    const meta = PINNED_ASSETS.find((a) => a.file === name);
    const destFile = join(destination, name);
    if (await fileMatches(destFile, meta.size, meta.sha256)) continue;
    const localFile = join(localResearchDir, name);
    if (await fileMatches(localFile, meta.size, meta.sha256)) {
      await copyFile(localFile, destFile);
      continue;
    }
    allReady = false;
  }

  if (!allReady) {
    await mkdir(temporary, { recursive: true });
    const integrity =
      'bsZ7K55hNakFbCVIrCsuwEFLLiWa/1/KI6dXEK3CwtI6N/j/Zc1LMheo1syMJhG0e4gu7MXPwbtKfbm44BQYIg==';
    const tarball = join(temporary, 'sherpa-onnx-1.13.8.tgz');
    let tarBytes;
    try {
      tarBytes = await readFile(tarball);
    } catch {
      /* download below */
    }
    if (!tarBytes || hash(tarBytes, 'sha512', 'base64') !== integrity) {
      const response = await fetch('https://registry.npmjs.org/sherpa-onnx/-/sherpa-onnx-1.13.8.tgz');
      if (!response.ok) throw new Error(`HTTP ${response.status} while fetching sherpa-onnx runtime`);
      tarBytes = Buffer.from(await response.arrayBuffer());
      if (hash(tarBytes, 'sha512', 'base64') !== integrity)
        throw new Error('sherpa-onnx tarball checksum mismatch');
      await writeFile(tarball, tarBytes);
    }
    execFileSync('tar', ['-xzf', 'sherpa-onnx-1.13.8.tgz'], { cwd: temporary });
    const packageDir = join(temporary, 'package');
    let loader = await readFile(join(packageDir, 'sherpa-onnx-wasm-nodejs.js'), 'utf8');
    const wrapper = await readFile(join(packageDir, 'sherpa-onnx-asr.js'), 'utf8');
    const loaderEnd = loader.lastIndexOf('if(typeof exports===');
    const wrapperEnd = wrapper.lastIndexOf("if (typeof process == 'object'");
    const rawStart = loader.indexOf('if(!ENVIRONMENT_IS_NODE){throw new Error("NODERAWFS');
    const rawEnd = loader.indexOf('{if(Module["noExitRuntime"])', rawStart);
    if (loaderEnd < 0 || wrapperEnd < 0 || rawStart < 0 || rawEnd < 0)
      throw new Error('Pinned sherpa-onnx layout changed');
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
    await copyFile(
      join(packageDir, 'sherpa-onnx-wasm-nodejs.wasm'),
      join(destination, 'sherpa.wasm'),
    );
  }

  for (const name of RUNTIME_FILES) {
    const meta = PINNED_ASSETS.find((a) => a.file === name);
    if (!(await fileMatches(join(destination, name), meta.size, meta.sha256))) {
      throw new Error(`Gipformer web runtime checksum mismatch: ${name}`);
    }
  }

  const totalBytes = PINNED_ASSETS.reduce((sum, asset) => sum + asset.size, 0);
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
        },
        assets: PINNED_ASSETS,
        bytes: totalBytes,
      },
      null,
      2,
    ) + '\n',
  );
  console.log('Prepared Gipformer 1.5 WebAssembly runtime in public/research/gipformer');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await prepareGipformerWebRuntime();
}
