import type * as Ort from 'onnxruntime-web/wasm';

/** Pay provider compilation before READY, without publishing a synthetic prediction. */
export async function warmClassifier(
  ort: typeof import('onnxruntime-web/wasm'),
  session: Ort.InferenceSession,
  size: number,
) {
  const tensor = new ort.Tensor('float32', new Float32Array(3 * size * size), [1, 3, size, size]);
  let outputs: Ort.InferenceSession.ReturnType | undefined;
  try {
    outputs = await session.run({ [session.inputNames[0]]: tensor });
  } finally {
    tensor.dispose();
    if (outputs) Object.values(outputs).forEach((output) => output.dispose());
  }
}
