import * as ort from 'onnxruntime-web/wasm';
import type { SpeechAudioQuality } from '../../domain/audio';
import type { ModalityEvidence } from '../../domain/conversation';
import { mapEmotionScores } from '../../domain/emotionScores';
import { PhoBertTokenizer } from './phobert-tokenizer';
import { textWasmThreads } from './wasmThreads';

const TEXT = '/models/local/huyleit/phobert-emotion-social';
// The pinned config contains LABEL_0..6. Semantic order comes from the same
// immutable revision's model card, not an assumed alphabetical ordering.
export const PHOBERT_LABELS = [
  'Enjoyment',
  'Sadness',
  'Disgust',
  'Anger',
  'Fear',
  'Surprise',
  'Other',
];
export { mapEmotionScores } from '../../domain/emotionScores';
async function json(path: string) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('Missing model metadata');
  return response.json();
}
/** Adapter boundary: callers do not depend on ONNX tensor or tokenizer details. */
export class EmotionProvider {
  private text: ort.InferenceSession | null = null;
  private tokenizer: PhoBertTokenizer | null = null;
  private textLabels: string[] = [];
  async initialize() {
    ort.env.wasm.wasmPaths = '/runtime/ort/';
    ort.env.wasm.numThreads = textWasmThreads();
    ort.env.wasm.proxy = false;
    const [vocab, codes, textConfig] = await Promise.all([
      fetch(TEXT + '/vocab.txt').then((r) => r.text()),
      fetch(TEXT + '/bpe.codes').then((r) => r.text()),
      json(TEXT + '/config.json'),
    ]);
    this.tokenizer = new PhoBertTokenizer(vocab, codes);
    if (
      Object.keys(textConfig.id2label).length !== PHOBERT_LABELS.length ||
      PHOBERT_LABELS.some((label, i) => ![label, `LABEL_${i}`].includes(textConfig.id2label[i]))
    )
      throw new Error('Unexpected PhoBERT label contract');
    this.textLabels = [...PHOBERT_LABELS];
    this.text = await ort.InferenceSession.create(TEXT + '/onnx/phobert_emotion_int8.onnx', {
      executionProviders: ['wasm'],
    });
  }
  async infer(
    text: string,
    startMs: number,
    endMs: number,
    quality?: SpeechAudioQuality,
  ): Promise<ModalityEvidence[]> {
    if (!this.text || !this.tokenizer) throw new Error('Provider not initialized');
    const ids = this.tokenizer.encode(text);
    const feeds: Record<string, ort.Tensor> = {
      input_ids: new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), [1, ids.length]),
      attention_mask: new ort.Tensor(
        'int64',
        BigInt64Array.from(ids, () => 1n),
        [1, ids.length],
      ),
    };
    let textScores: ReturnType<typeof mapEmotionScores>;
    let textOutput: ort.InferenceSession.ReturnType | undefined;
    try {
      textOutput = await this.text.run(feeds);
      textScores = mapEmotionScores(textOutput.logits.data as Float32Array, this.textLabels);
    } finally {
      if (textOutput) Object.values(textOutput).forEach((t) => t.dispose());
      Object.values(feeds).forEach((t) => t.dispose());
    }
    const signalToNoise = quality
      ? quality.speechRms / Math.max(quality.noiseRms, 0.002)
      : Number.POSITIVE_INFINITY;
    const audioUsable =
      !quality ||
      (quality.speechRms >= 0.005 && quality.clippingRatio < 0.05 && signalToNoise >= 1.5);
    const audioReason =
      quality && quality.speechRms < 0.005
        ? 'quiet-audio'
        : quality && quality.clippingRatio >= 0.05
          ? 'clipped-audio'
          : quality && signalToNoise < 1.5
            ? 'low-signal-to-noise'
            : undefined;
    return [
      {
        source: 'text',
        startMs,
        endMs,
        ...textScores,
        quality: text.trim().split(/\s+/u).length >= 2 && audioUsable ? 'usable' : 'rejected',
        reason:
          audioReason ?? (text.trim().split(/\s+/u).length < 2 ? 'short-transcript' : undefined),
        modelVersion: 'phobert-social-int8-422ce995',
      },
    ];
  }
  async dispose() {
    await this.text?.release();
    this.text = null;
    this.tokenizer = null;
  }
}
