/**
 * EmotiEffLib B2 ONNX input/output contract (260px); explicit dimensions support lab fixtures.
 * Upstream labels: anger, contempt, disgust, fear, happiness, neutral, sadness, surprise.
 * SignEmo keeps its historical FER-compatible canonical order after mapping.
 */
export const EMOTIEFF_LABELS = [
  'anger',
  'contempt',
  'disgust',
  'fear',
  'happiness',
  'neutral',
  'sadness',
  'surprise',
] as const;

const TO_SIGNEMO_ORDER = [5, 4, 7, 6, 0, 2, 3, 1] as const;
const MEAN = [0.485, 0.456, 0.406] as const;
const STD = [0.229, 0.224, 0.225] as const;

/** Converts a browser RGBA ImageData buffer into RGB ImageNet-normalized NCHW input. */
export function toEmotiEffInput(
  rgba: ArrayLike<number>,
  width = 260,
  height = 260,
  destination?: Float32Array,
): Float32Array {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    rgba.length !== width * height * 4
  ) {
    throw new Error('Ảnh đầu vào EmotiEffLib không hợp lệ');
  }
  const pixels = width * height;
  const input = destination ?? new Float32Array(pixels * 3);
  if (input.length !== pixels * 3) throw new Error('Bộ đệm RGB không đúng kích thước');
  for (let pixel = 0; pixel < pixels; pixel++) {
    const source = pixel * 4;
    for (let channel = 0; channel < 3; channel++) {
      const value = Number(rgba[source + channel]);
      if (!Number.isFinite(value) || value < 0 || value > 255)
        throw new Error('Giá trị ảnh EmotiEffLib không hợp lệ');
      input[channel * pixels + pixel] = (value / 255 - MEAN[channel]) / STD[channel];
    }
  }
  return input;
}

/** Maps EmotiEffLib logits to SignEmo's stable 8-class order before softmax. */
export function toSignEmoEmotionOrder(logits: ArrayLike<number>): Float32Array {
  if (logits.length !== 8 || Array.from(logits).some((value) => !Number.isFinite(value)))
    throw new Error('Đầu ra EmotiEffLib không hợp lệ');
  return Float32Array.from(TO_SIGNEMO_ORDER, (index) => logits[index]);
}
