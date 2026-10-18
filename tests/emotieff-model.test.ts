import { describe, expect, it } from 'vitest';
import {
  toEmotiEffInput,
  toSignEmoEmotionOrder,
} from '../src/infrastructure/inference/emotieff-model';

describe('EmotiEffLib model contract', () => {
  it('uses the B2 260px contract instead of silently accepting a B0-sized crop', () => {
    expect(toEmotiEffInput(new Uint8Array(260 * 260 * 4))).toHaveLength(3 * 260 * 260);
    expect(() => toEmotiEffInput(new Uint8Array(224 * 224 * 4))).toThrow();
  });
  it('normalizes RGB bytes into ImageNet-normalized NCHW channels', () => {
    const input = toEmotiEffInput(new Uint8ClampedArray([0, 128, 255, 255]), 1, 1);

    expect(input).toHaveLength(3);
    expect(input[0]).toBeCloseTo((0 - 0.485) / 0.229, 5);
    expect(input[1]).toBeCloseTo((128 / 255 - 0.456) / 0.224, 5);
    expect(input[2]).toBeCloseTo((1 - 0.406) / 0.225, 5);
  });

  it('maps upstream logits to the stable SignEmo class order', () => {
    const scores = toSignEmoEmotionOrder([10, 11, 12, 13, 14, 15, 16, 17]);

    expect(Array.from(scores)).toEqual([15, 14, 17, 16, 10, 12, 13, 11]);
  });

  it('rejects malformed pixel buffers and model outputs', () => {
    expect(() => toEmotiEffInput([0, 0, 0])).toThrow('không hợp lệ');
    expect(() => toEmotiEffInput([0, 0, 0, 0], 0, 1)).toThrow('không hợp lệ');
    expect(() => toEmotiEffInput([0, 0, Number.NaN, 0])).toThrow('không hợp lệ');
    expect(() => toSignEmoEmotionOrder([1, 2])).toThrow('không hợp lệ');
    expect(() => toSignEmoEmotionOrder([1, 2, 3, 4, 5, 6, 7, Infinity])).toThrow('không hợp lệ');
  });
});
