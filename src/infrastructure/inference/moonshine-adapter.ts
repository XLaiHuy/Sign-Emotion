import type { AsrAdapter, AsrRequest } from '../../domain/asr';
import type { TranscriptSegment } from '../../domain/conversation';
import {
  MOONSHINE_ASSETS,
  MOONSHINE_CACHE,
  MOONSHINE_LOCK,
  MOONSHINE_RUNTIME_ROOT,
  MOONSHINE_RUNTIME_ID,
} from './moonshine-assets';
import { downloadCandidate } from '../offline/downloadCandidate';

const MODEL_ROOT = '/models/moonshine/tiny-streaming-vi/';
const CACHE_NAME = MOONSHINE_CACHE;
const MODEL_VERSION = 'moonshine-streaming-tiny-vi@quantized_26_08_24';
const MAX_PROFILE_BYTES = 100 * 1024 * 1024;
const MODEL_FILES = [
  'adapter.ort',
  'cross_kv.ort',
  'decoder_kv.ort',
  'encoder.ort',
  'frontend.model.ort',
  'frontend.weights.ort',
  'streaming_config.json',
  'tokenizer.bin',
] as const;

interface MoonshineStream {
  start(): void;
  stop(): void;
  addAudio(samples: Float32Array, sampleRate: number): void;
  transcribe(flags?: number): { lines: readonly { text: string }[] };
  close(): void;
}

interface MoonshineTranscriber {
  createStream(options?: { updateInterval?: number }): MoonshineStream;
  close(): void;
}

interface MoonshineRuntime {
  transcriber: MoonshineTranscriber;
  forceUpdate: number;
}

interface MoonshineManifest {
  version: string;
  license: string;
  modelBytes: number;
  totalBytes: number;
  maxBytes: number;
  assets: Array<{ file: string; url: string; bytes: number; sha256: string }>;
}

type RuntimeFactory = () => Promise<MoonshineRuntime>;

async function loadRuntime(): Promise<MoonshineRuntime> {
  if (!self.crossOriginIsolated)
    throw new Error('Moonshine cần môi trường cô lập trên localhost. Mở ?moonshine=1 rồi thử lại.');

  // The immutable lock is bundled with the app; offline startup needs no live manifest.
  const manifest: MoonshineManifest = {
    version: MODEL_VERSION,
    license: MOONSHINE_LOCK.license,
    modelBytes: MOONSHINE_LOCK.assets.reduce((n, a) => n + a.bytes, 0),
    totalBytes: MOONSHINE_ASSETS.reduce((n, a) => n + a.bytes, 0),
    maxBytes: MAX_PROFILE_BYTES,
    assets: MOONSHINE_ASSETS.filter((a) => a.url.startsWith(MODEL_ROOT)),
  };
  if (
    manifest.version !== MODEL_VERSION ||
    manifest.license !== 'MIT' ||
    manifest.maxBytes !== MAX_PROFILE_BYTES ||
    !Number.isSafeInteger(manifest.totalBytes) ||
    manifest.totalBytes <= 0 ||
    manifest.totalBytes > MAX_PROFILE_BYTES ||
    !Array.isArray(manifest.assets) ||
    manifest.assets.length !== MODEL_FILES.length ||
    new Set(manifest.assets.map((asset) => asset.file)).size !== MODEL_FILES.length ||
    MODEL_FILES.some((file) => !manifest.assets.some((asset) => asset.file === file))
  )
    throw new Error('Manifest Moonshine không khớp profile đã ghim.');

  const cache = await caches.open(CACHE_NAME);
  const files = new Map<string, Uint8Array>();
  for (const asset of MOONSHINE_ASSETS) {
    const { file, url } = asset;
    if (
      (!url.startsWith(MODEL_ROOT) && !url.startsWith('/runtime/moonshine/')) ||
      !Number.isSafeInteger(asset.bytes) ||
      asset.bytes <= 0 ||
      !/^[a-f0-9]{64}$/.test(asset.sha256)
    )
      throw new Error('Thông tin một tệp Moonshine không hợp lệ.');

    let cached = await cache.match(url);
    let bytes = cached ? new Uint8Array(await cached.arrayBuffer()) : undefined;
    if (bytes && !(await matches(bytes, asset))) {
      await cache.delete(url);
      cached = undefined;
      bytes = undefined;
    }
    if (!bytes) {
      bytes = await downloadCandidate(asset, () => {});
      if (!(await matches(bytes, asset))) throw new Error('Checksum model Moonshine không khớp.');
      await cache.put(
        url,
        new Response(bytes.slice(), {
          headers: {
            'Content-Type': file.endsWith('.mjs')
              ? 'application/javascript'
              : file.endsWith('.wasm')
                ? 'application/wasm'
                : 'application/octet-stream',
            'Cross-Origin-Embedder-Policy': 'require-corp',
          },
        }),
      );
    }
    if (url.startsWith(MODEL_ROOT)) files.set(file, bytes);
  }

  const { ModelArch, Transcriber, TranscribeFlags } = await import('@moonshine-ai/moonshine-wasm');
  const runtimeUrl = new URL(MOONSHINE_RUNTIME_ROOT + 'moonshine.mjs', self.location.origin).href;
  const transcriber = await Transcriber.load({
    files,
    modelArch: ModelArch.TinyStreaming,
    moduleOptions: {
      factory: async (options) => {
        const module = await import(/* @vite-ignore */ runtimeUrl);
        const factory = module.default ?? module;
        return factory({
          ...options,
          locateFile: (path: string) => new URL(path, runtimeUrl).href,
        });
      },
    },
  });
  // Compile/initialize the first streaming pass before device permission.
  // This synthetic signal is discarded and never enters captions, fusion or storage.
  const warm = transcriber.createStream({ updateInterval: 0.5 });
  try {
    try {
      warm.start();
      warm.addAudio(
        Float32Array.from({ length: 16000 }, (_, i) => 0.01 * Math.sin(i * 0.08)),
        16000,
      );
      warm.stop();
    } finally {
      warm.close();
    }
  } catch (error) {
    transcriber.close();
    throw error;
  }
  return { transcriber, forceUpdate: TranscribeFlags.ForceUpdate };
}

async function matches(bytes: Uint8Array, asset: MoonshineManifest['assets'][number]) {
  if (bytes.byteLength !== asset.bytes) return false;
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer as ArrayBuffer);
  const hex = Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('');
  return hex === asset.sha256;
}

export class MoonshineStreamingAdapter implements AsrAdapter {
  private runtime: MoonshineRuntime | null = null;
  private activeId = '';
  private fedSamples = 0;
  private generation = 0;
  constructor(private readonly createRuntime: RuntimeFactory = loadRuntime) {}

  async prepare() {
    const generation = this.generation;
    const runtime = await this.createRuntime();
    if (generation !== this.generation) {
      runtime.transcriber.close();
      throw new DOMException('Cancelled', 'AbortError');
    }
    this.runtime = runtime;
    return {
      modelVersion: MODEL_VERSION,
      fallback: false,
      executionProfile: {
        runtime: MOONSHINE_RUNTIME_ID,
        backend: 'wasm' as const,
        intraOpThreads:
          MOONSHINE_RUNTIME_ID === 'official' ? null : MOONSHINE_RUNTIME_ID === 'two' ? 2 : 1,
        interOpThreads: MOONSHINE_RUNTIME_ID === 'official' ? null : 1,
      },
    };
  }

  async acceptPcm(request: AsrRequest, final: boolean): Promise<TranscriptSegment> {
    const runtime = this.runtime;
    if (!runtime) throw new Error('Moonshine chưa được chuẩn bị.');
    if (
      !request.samples.length ||
      request.samples.length > 30 * 16000 ||
      request.samples.some((value) => !Number.isFinite(value))
    )
      throw new Error('PCM không hợp lệ.');

    if (this.activeId !== request.id) {
      this.closeStream();
      this.stream = runtime.transcriber.createStream({ updateInterval: 0.5 });
      this.stream.start();
      this.activeId = request.id;
      this.fedSamples = 0;
    }
    const stream = this.stream;
    if (!stream) throw new Error('Không tạo được luồng phụ đề Moonshine.');
    if (request.samples.length < this.fedSamples) throw new Error('Cửa sổ PCM cũ đã bị thay thế.');

    const start = performance.now();
    if (request.samples.length > this.fedSamples) {
      stream.addAudio(request.samples.subarray(this.fedSamples), 16000);
      this.fedSamples = request.samples.length;
    }
    const generation = this.generation;
    // stop() flushes the streaming encoder lookahead and completes the last line.
    // A following unforced read returns that snapshot without decoding twice.
    if (final) stream.stop();
    const transcript = stream.transcribe();
    if (generation !== this.generation) throw new DOMException('Cancelled', 'AbortError');
    const text = transcript.lines
      .map((line) => line.text.trim())
      .filter(Boolean)
      .join(' ')
      .trim();
    const finalizedAtMs = performance.now();
    const segment: TranscriptSegment = {
      id: request.id,
      startMs: request.startMs,
      endMs: request.endMs,
      text,
      modelVersion: MODEL_VERSION,
      processingMs: finalizedAtMs - start,
      finalizedAtMs,
      boundary: request.boundary,
      utteranceId: request.utteranceId,
      revision: request.revision,
    };
    if (final) this.closeStream();
    return segment;
  }

  private stream: MoonshineStream | null = null;
  private closeStream() {
    this.stream?.close();
    this.stream = null;
    this.activeId = '';
    this.fedSamples = 0;
  }

  reset() {
    this.generation++;
    this.closeStream();
  }

  async dispose() {
    this.reset();
    const runtime = this.runtime;
    this.runtime = null;
    runtime?.transcriber.close();
  }
}
