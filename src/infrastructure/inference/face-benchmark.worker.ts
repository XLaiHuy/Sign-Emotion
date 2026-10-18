/// <reference lib="webworker" />
import type * as Ort from 'onnxruntime-web/wasm';
import { toEmotiEffInput } from './emotieff-model';
import {
  faceProfileContract,
  loadResearchFaceModel,
  type FaceModelProfile,
} from './face-model-profile';

// Explicit classifier probe. Numeric parity/timing is not expression accuracy.
self.onmessage = async ({ data }: MessageEvent) => {
  let session: Ort.InferenceSession | null = null;
  let tensor: Ort.Tensor | null = null;
  try {
    if (data.type !== 'benchmark') throw new Error('Invalid probe');
    const profile: FaceModelProfile = data.profile === 'b2' ? 'emotieff-b2-research' : data.profile;
    const contract = faceProfileContract(profile);
    if (
      contract.backend === 'webgpu' &&
      (!navigator.gpu || !(await navigator.gpu.requestAdapter()))
    )
      throw new Error('Unavailable GPU');
    const ort =
      contract.backend === 'webgpu'
        ? await import('onnxruntime-web/webgpu')
        : await import('onnxruntime-web/wasm');
    ort.env.wasm.wasmPaths =
      contract.backend === 'webgpu' ? '/research/runtime-ort-gpu/' : '/runtime/ort/';
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    const started = performance.now();
    const options: Ort.InferenceSession.SessionOptions = {
      executionProviders: [contract.backend],
      graphOptimizationLevel: 'all',
    };
    session =
      profile === 'product'
        ? await ort.InferenceSession.create('/models/enet_b2_8.onnx', options)
        : await ort.InferenceSession.create(await loadResearchFaceModel(profile), options);
    const prepareMs = performance.now() - started;
    tensor = new ort.Tensor('float32', toEmotiEffInput(data.rgba, contract.size, contract.size), [
      1,
      3,
      contract.size,
      contract.size,
    ]);
    const durations: number[] = [];
    let logits: number[] = [],
      coldMs = 0;
    for (let i = 0; i < 31; i++) {
      const start = performance.now();
      const outputs = await session.run({ [session.inputNames[0]]: tensor });
      try {
        if (i === 0) {
          coldMs = performance.now() - start;
          logits = Array.from(outputs[session.outputNames[0]].data as Float32Array);
        } else durations.push(performance.now() - start);
      } finally {
        Object.values(outputs).forEach((output) => output.dispose());
      }
    }
    self.postMessage({
      type: 'result',
      profile,
      backend: contract.backend,
      version: contract.version,
      logits,
      durations,
      coldMs,
      prepareMs,
    });
  } catch {
    self.postMessage({ type: 'error', code: 'face-benchmark-failed' });
  } finally {
    tensor?.dispose();
    await session?.release();
  }
};
