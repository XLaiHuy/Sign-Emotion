import { describe, expect, it, vi } from 'vitest';
import {
  BASELINE_ASR_PROFILE,
  loadSpeechModel,
  VIETNAMESE_ASR_PROFILE,
} from '../src/infrastructure/inference/speech-model-profile';

describe('Vietnamese ASR profile selection', () => {
  it('loads PhoWhisper tiny before the multilingual Whisper baseline', async () => {
    const create = vi.fn(async () => ({ loaded: true }));

    const result = await loadSpeechModel(create);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(VIETNAMESE_ASR_PROFILE);
    expect(result).toEqual({
      model: { loaded: true },
      profile: VIETNAMESE_ASR_PROFILE,
      usedFallback: false,
    });
  });

  it('falls back to the current multilingual model only when PhoWhisper cannot load', async () => {
    const create = vi.fn(async (profile) => {
      if (profile.id === VIETNAMESE_ASR_PROFILE.id) throw new Error('model load failed');
      return { loaded: true };
    });

    const result = await loadSpeechModel(create);

    expect(create.mock.calls.map(([profile]) => profile)).toEqual([
      VIETNAMESE_ASR_PROFILE,
      BASELINE_ASR_PROFILE,
    ]);
    expect(result.profile).toBe(BASELINE_ASR_PROFILE);
    expect(result.usedFallback).toBe(true);
  });

  it('surfaces failure when neither local model can initialize', async () => {
    const failure = new Error('local model unavailable');
    const create = vi.fn().mockRejectedValue(failure);

    await expect(loadSpeechModel(create)).rejects.toBe(failure);
    expect(create).toHaveBeenCalledTimes(2);
  });
});
