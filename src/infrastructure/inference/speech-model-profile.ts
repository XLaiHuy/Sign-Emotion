export interface SpeechModelProfile {
  id: string;
  version: string;
}

export const VIETNAMESE_ASR_PROFILE: SpeechModelProfile = {
  id: 'huuquyet/PhoWhisper-tiny',
  version: 'phowhisper-tiny-q8@29a5ac0',
};

export const BASELINE_ASR_PROFILE: SpeechModelProfile = {
  id: 'onnx-community/whisper-tiny',
  version: 'whisper-tiny-q8',
};

export interface LoadedSpeechModel<Model> {
  model: Model;
  profile: SpeechModelProfile;
  usedFallback: boolean;
}

/** Prefer the Vietnamese-finetuned profile, keeping the known baseline as a load fallback. */
export async function loadSpeechModel<Model>(
  create: (profile: SpeechModelProfile) => Promise<Model>,
): Promise<LoadedSpeechModel<Model>> {
  try {
    return {
      model: await create(VIETNAMESE_ASR_PROFILE),
      profile: VIETNAMESE_ASR_PROFILE,
      usedFallback: false,
    };
  } catch {
    return {
      model: await create(BASELINE_ASR_PROFILE),
      profile: BASELINE_ASR_PROFILE,
      usedFallback: true,
    };
  }
}
