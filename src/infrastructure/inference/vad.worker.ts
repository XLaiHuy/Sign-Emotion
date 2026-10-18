/// <reference lib="webworker" />
import * as ort from 'onnxruntime-web/wasm';
import { UtteranceBuilder } from '../../domain/audio';
ort.env.wasm.wasmPaths = '/runtime/ort/';
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
let session: ort.InferenceSession | null = null;
let state = new Float32Array(256);
let context = new Float32Array(64);
let builder = new UtteranceBuilder();
let chain = Promise.resolve();
let queued = 0;
let failed = false;
let lastInterimEndSample = 0;
let interimRevision = 0;
let partialPolicy: 'baseline' | 'early-candidate' | 'streaming-candidate' = 'baseline';
let partialIntervalSamples = 12_800;
let requestedPartialInterval = 8192;
async function frame(samples: Float32Array, offset: number) {
  if (!session || failed) return;
  const input = new Float32Array(576);
  input.set(context);
  input.set(samples, 64);
  const feeds = {
    input: new ort.Tensor('float32', input, [1, 576]),
    state: new ort.Tensor('float32', state, [2, 1, 128]),
    sr: new ort.Tensor('int64', BigInt64Array.of(16000n), []),
  };
  let outputs: ort.InferenceSession.ReturnType | undefined;
  try {
    outputs = await session.run(feeds);
    state = Float32Array.from(outputs.stateN.data as Float32Array);
    context = samples.slice(-64);
    const probability = Number(outputs.output.data[0]);
    self.postMessage({ type: 'activity', speaking: probability >= 0.5 });
    const chunk = builder.push(samples, probability, offset);
    if (chunk) {
      const id = `utterance-${chunk.startSample}`;
      self.postMessage({ type: 'chunk', id, ...chunk }, [chunk.samples.buffer]);
      lastInterimEndSample = chunk.endSample;
      interimRevision = 0;
    } else if (
      offset + samples.length - lastInterimEndSample >=
      (interimRevision === 0 ? partialIntervalSamples : requestedPartialInterval)
    ) {
      // Copy the growing utterance only when a partial can actually be sent.
      // Previously snapshot() copied it every 32 ms after becoming eligible.
      const snapshot = builder.snapshot(partialPolicy);
      if (snapshot) {
        lastInterimEndSample = snapshot.endSample;
        const id = `utterance-${snapshot.startSample}`;
        self.postMessage({ type: 'interim', id, revision: ++interimRevision, ...snapshot }, [
          snapshot.samples.buffer,
        ]);
      }
    }
  } finally {
    Object.values(feeds).forEach((t) => t.dispose());
    if (outputs) Object.values(outputs).forEach((t) => t.dispose());
  }
}
self.onmessage = (event) => {
  if (event.data.type === 'init') {
    builder = new UtteranceBuilder(
      event.data.prosody === true,
      typeof event.data.silenceHangoverFrames === 'number'
        ? event.data.silenceHangoverFrames
        : event.data.fastEndpointing === true
          ? 13
          : 17,
    );
    partialPolicy =
      event.data.streaming === true
        ? 'streaming-candidate'
        : event.data.earlyPartials === true
          ? 'early-candidate'
          : 'baseline';
    partialIntervalSamples = event.data.streaming === true ? 8192 : 12800;
    requestedPartialInterval = partialIntervalSamples;
    chain = ort.InferenceSession.create('/models/local/silero_vad.onnx', {
      executionProviders: ['wasm'],
    }).then((value) => {
      session = value;
      self.postMessage({ type: 'ready' });
    });
  } else if (event.data.type === 'partial-budget' && partialPolicy === 'streaming-candidate') {
    if ([8192, 12288, 16384].includes(event.data.samples))
      requestedPartialInterval = event.data.samples;
  } else if (event.data.type === 'frame' && !failed) {
    if (++queued > 96) {
      failed = true;
      self.postMessage({
        type: 'error',
        message: 'Xử lý tiếng nói không theo kịp. Đã dừng micro để tránh mất lời nói.',
      });
      return;
    }
    chain = chain.then(() => frame(event.data.samples, event.data.offset)).finally(() => queued--);
  } else if (event.data.type === 'flush') {
    chain = chain.then(() => {
      const chunk = builder.flush();
      if (chunk) {
        const id = `utterance-${chunk.startSample}`;
        self.postMessage({ type: 'chunk', id, ...chunk }, [chunk.samples.buffer]);
        lastInterimEndSample = chunk.endSample;
        interimRevision = 0;
      }
      if (event.data.reset === true) {
        state = new Float32Array(256);
        context = new Float32Array(64);
      }
      self.postMessage({ type: 'flushed' });
    });
  }
  chain = chain.catch(() => {
    failed = true;
    self.postMessage({
      type: 'error',
      message: 'Không chạy được VAD local. Kiểm tra tài nguyên rồi thử lại.',
    });
  });
};
