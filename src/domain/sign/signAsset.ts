export interface SignAsset {
  kind: 'video' | 'glb';
  url: string;
  sha256: string;
  source: string;
  license: string;
  selfChecked: boolean;
  technicalVerified: boolean;
  clipName?: string;
}

export function eligibleSignAsset(asset?: SignAsset): asset is SignAsset {
  return (
    !!asset &&
    asset.selfChecked &&
    asset.technicalVerified &&
    !!asset.source &&
    !!asset.license &&
    /^[a-f0-9]{64}$/.test(asset.sha256) &&
    /^\/signs\/[a-zA-Z0-9_./-]+$/.test(asset.url) &&
    !asset.url.includes('..')
  );
}
