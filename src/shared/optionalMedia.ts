import type { Expression } from './contracts';

export interface OptionalMediaAsset {
  url: string;
  bytes: number;
  sha256: string;
  contentType: 'video/mp4' | 'text/vtt';
}
export const introVideo: OptionalMediaAsset = {
  url: '/demo/signemo-intro-024f4ba8af16.mp4',
  bytes: 3904770,
  sha256: '024f4ba8af16b8c3941e29774b8d2d42020e5e5a8e40dc93e89c24881528d4ce',
  contentType: 'video/mp4',
};
export const introCaptions: OptionalMediaAsset = {
  url: '/demo/signemo-intro-024f4ba8af16.vi.vtt',
  bytes: 394,
  sha256: '6b36f2b92bc9a14e8448a5d008fef2385e3250aa7ad49576cf0b06062a674101',
  contentType: 'text/vtt',
};
export interface SignVideoAsset extends OptionalMediaAsset {
  expression: Exclude<Expression, 'neutral'>;
  region: 'TP.HCM';
  source: string;
  license: string;
  attribution: string;
}
// Only verified regional vocabulary with redistribution rights belongs here.
export const signVideos: readonly SignVideoAsset[] = [];
