import type { AsrAdapter, AsrRequest } from '../../domain/asr';
import { GIPFORMER_MANIFEST } from './gipformer-assets';
interface SherpaStream {
  acceptWaveform(rate: number, samples: Float32Array): void;
  free(): void;
}
interface SherpaRecognizer {
  handle: number;
  createStream(): SherpaStream;
  decode(stream: SherpaStream): void;
  getResult(stream: SherpaStream): { text: string };
  free(): void;
}
interface SherpaModule {
  FS: { writeFile(path: string, data: Uint8Array): void; unlink(path: string): void };
}
interface ResearchAsset {
  file: string;
  size: number;
  sha256: string;
}
const ROOT = '/research/gipformer/';
const MODEL_FILES = ['encoder.int8.onnx', 'decoder.int8.onnx', 'joiner.int8.onnx', 'tokens.txt'];
/** Explicit lab profile: no microphone or remote inference. */
export class GipformerAdapter implements AsrAdapter {
  private module: SherpaModule | null = null;
  private recognizer: SherpaRecognizer | null = null;
  private generation = 0;
  async prepare() {
    const generation = this.generation;
    const cache = await caches.open('signemo-research-gipformer-v1');
    let response: Response;
    try {
      response =
        (await cache.match(ROOT + 'manifest.json')) ?? (await fetch(ROOT + 'manifest.json'));
    } catch {
      response = (await cache.match(ROOT + 'manifest.json')) ?? new Response('', { status: 404 });
    }
    if (!response.ok) throw new Error('Chưa chuẩn bị Gipformer nghiên cứu.');
    const manifest = (await response.json()) as { profile: string; assets: ResearchAsset[] };
    const allowed = [...MODEL_FILES, 'sherpa.mjs', 'asr.mjs', 'sherpa.wasm'];
    if (
      manifest.profile !== 'gipformer1.5-int8@sherpa-1.13.8' ||
      manifest.assets.length !== allowed.length ||
      new Set(manifest.assets.map((a) => a.file)).size !== allowed.length ||
      manifest.assets.some(
        (a) =>
          !allowed.includes(a.file) ||
          !GIPFORMER_MANIFEST.assets.some(
            (pinned) =>
              pinned.file === a.file && pinned.size === a.size && pinned.sha256 === a.sha256,
          ) ||
          !/^[a-f0-9]{64}$/.test(a.sha256) ||
          !Number.isSafeInteger(a.size) ||
          a.size <= 0,
      ) ||
      manifest.assets.reduce((sum, a) => sum + a.size, 0) > 100 * 1048576
    )
      throw new Error('Profile Gipformer không hợp lệ.');
    const read = async (file: string) => {
      const asset = manifest.assets.find((item) => item.file === file)!;
      const cached = await cache.match(ROOT + file);
      let response = cached ?? (await fetch(ROOT + file));
      if (!response.ok) throw new Error('Thiếu asset nghiên cứu.');
      let bytes = new Uint8Array(await response.arrayBuffer());
      const digestOf = async (value: Uint8Array) =>
        Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(value))))
          .map((n) => n.toString(16).padStart(2, '0'))
          .join('');
      let digest = await digestOf(bytes);
      if (cached && (bytes.length !== asset.size || digest !== asset.sha256)) {
        await cache.delete(ROOT + file);
        response = await fetch(ROOT + file);
        if (!response.ok) throw new Error('Thiếu asset nghiên cứu.');
        bytes = new Uint8Array(await response.arrayBuffer());
        digest = await digestOf(bytes);
      }
      if (bytes.length !== asset.size || digest !== asset.sha256)
        throw new Error('Checksum nghiên cứu không khớp.');
      if (generation !== this.generation) throw new DOMException('Cancelled', 'AbortError');
      if (!cached || response !== cached)
        await cache.put(
          ROOT + file,
          new Response(bytes, {
            headers: {
              'Content-Type': file.endsWith('.mjs')
                ? 'application/javascript'
                : file.endsWith('.wasm')
                  ? 'application/wasm'
                  : 'application/octet-stream',
            },
          }),
        );
      return bytes;
    };
    await read('sherpa.mjs');
    await read('asr.mjs');
    const loaderUrl = ROOT + 'sherpa.mjs',
      wrapperUrl = ROOT + 'asr.mjs';
    const { default: createModule } = await import(/* @vite-ignore */ loaderUrl);
    const { OfflineRecognizer } = await import(/* @vite-ignore */ wrapperUrl);
    const module = (await createModule({
      wasmBinary: await read('sherpa.wasm'),
      print: () => {},
      printErr: () => {},
    })) as SherpaModule;
    this.module = module;
    try {
      for (const file of MODEL_FILES) module.FS.writeFile('/' + file, await read(file));
      const recognizer = new OfflineRecognizer(
        {
          featConfig: { sampleRate: 16000, featureDim: 80 },
          modelConfig: {
            transducer: {
              encoder: '/encoder.int8.onnx',
              decoder: '/decoder.int8.onnx',
              joiner: '/joiner.int8.onnx',
            },
            tokens: '/tokens.txt',
            numThreads: 1,
            provider: 'cpu',
            debug: 0,
          },
          decodingMethod: 'greedy_search',
        },
        module,
      ) as SherpaRecognizer;
      if (!recognizer.handle) throw new Error('Gipformer chưa khởi tạo được.');
      this.recognizer = recognizer;
      await cache.put(
        ROOT + 'manifest.json',
        new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/json' } }),
      );
      return { modelVersion: manifest.profile, fallback: false };
    } finally {
      for (const file of MODEL_FILES) {
        try {
          module.FS.unlink('/' + file);
        } catch {
          /* not loaded */
        }
      }
    }
  }
  async acceptPcm(request: AsrRequest, _final: boolean) {
    if (
      !this.recognizer ||
      !request.samples.length ||
      request.samples.length > 30 * 16000 ||
      request.samples.some((v) => !Number.isFinite(v))
    )
      throw new Error('PCM hoặc ASR chưa sẵn sàng.');
    const start = performance.now(),
      stream = this.recognizer.createStream();
    try {
      stream.acceptWaveform(16000, request.samples);
      this.recognizer.decode(stream);
      return {
        id: request.id,
        startMs: request.startMs,
        endMs: request.endMs,
        text: this.recognizer.getResult(stream).text.trim(),
        modelVersion: 'gipformer1.5-int8@sherpa-1.13.8',
        processingMs: performance.now() - start,
        finalizedAtMs: performance.now(),
        boundary: request.boundary,
        utteranceId: request.utteranceId,
      };
    } finally {
      stream.free();
    }
  }
  reset() {
    this.generation++;
  }
  async dispose() {
    this.reset();
    this.recognizer?.free();
    this.recognizer = null;
    this.module = null;
  }
}
