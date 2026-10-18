import { ModelInitializationError } from '../../domain/modelInitialization';

/** Content-addressed transport URL; runtime/CacheStorage keys remain unchanged. */
export function immutableAssetUrl(asset: { url: string; sha256?: string }) {
  if (asset.sha256 === undefined) return null;
  if (!/^[a-f0-9]{64}$/.test(asset.sha256)) throw new ModelInitializationError('integrity');
  if (
    !/^\/(?:models|runtime|research\/(?:gipformer|emotieff-b0|runtime-ort-gpu))(?:\/[A-Za-z0-9_.-]+)+$/.test(
      asset.url,
    ) ||
    /\/(?:\.|\.\.)(?:\/|$)/.test(asset.url)
  )
    return null;
  return `/immutable/${asset.sha256}${asset.url}`;
}
