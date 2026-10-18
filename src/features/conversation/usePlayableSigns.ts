import { useMemo } from 'react';
import { signPhrases100Catalogue, type SignPhraseItem } from '../../domain/signPhrases';
import { eligibleSignAsset } from '../../domain/sign/signAsset';

export function usePlayableSigns(enabled: boolean): readonly SignPhraseItem[] {
  return useMemo(
    () => (enabled ? signPhrases100Catalogue.filter((phrase) => eligibleSignAsset(phrase.asset)) : []),
    [enabled],
  );
}
