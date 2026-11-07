import type { Expression } from './contracts';

export interface OptionalMediaAsset {
  url: string;
  bytes: number;
  sha256: string;
  contentType: 'video/mp4' | 'text/vtt';
}
export const introVideo: OptionalMediaAsset = {
  url: '/demo/signemo-preview-24836d1d4c17.mp4',
  bytes: 2512668,
  sha256: '24836d1d4c17f8f8c1ba3953316b87d736f89d7217315f7956a9bc11e2ce90af',
  contentType: 'video/mp4',
};
export const introCaptions: OptionalMediaAsset = {
  url: '/demo/signemo-intro-024f4ba8af16.vi.vtt',
  bytes: 394,
  sha256: '6b36f2b92bc9a14e8448a5d008fef2385e3250aa7ad49576cf0b06062a674101',
  contentType: 'text/vtt',
};
export const introYouTube = {
  longId: 'E6AGaW7wE7k',
  shortId: 'jT6cjQ0aQhI',
  longUrl: 'https://www.youtube.com/watch?v=E6AGaW7wE7k',
  shortUrl: 'https://www.youtube.com/watch?v=jT6cjQ0aQhI',
  embedUrl: 'https://www.youtube.com/embed/E6AGaW7wE7k?autoplay=1&rel=0',
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
