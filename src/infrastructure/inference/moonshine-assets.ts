import lock from '../../../scripts/moonshine-streaming-vi.lock.json';
import profilesJson from '../../../scripts/moonshine-runtime-profiles.lock.json';
const profiles = profilesJson as Partial<Record<string, { assets: typeof lock.runtimeAssets }>>;
const requested = import.meta.env.VITE_MOONSHINE_RUNTIME;
export const MOONSHINE_RUNTIME_ID =
  requested === 'single' || requested === 'two' ? requested : 'official';
if (MOONSHINE_RUNTIME_ID !== 'official' && !profiles[MOONSHINE_RUNTIME_ID])
  throw new Error('Runtime nghiên cứu chưa build hoặc chưa ghim checksum');
export const MOONSHINE_RUNTIME_ROOT = `/runtime/moonshine/${MOONSHINE_RUNTIME_ID === 'official' ? '' : MOONSHINE_RUNTIME_ID + '/'}`;

/** One pinned source for preparation and the browser. Runtime release differs from npm's binary. */
export const MOONSHINE_LOCK = {
  ...lock,
  runtimeAssets: profiles[MOONSHINE_RUNTIME_ID]?.assets ?? lock.runtimeAssets,
};
export const MOONSHINE_CACHE = 'signemo-moonshine-vi-release-v2';
export const MOONSHINE_ASSETS = [
  ...lock.assets.map((asset) => ({
    ...asset,
    url: `/models/moonshine/tiny-streaming-vi/${asset.file}`,
  })),
  ...MOONSHINE_LOCK.runtimeAssets.map((asset) => ({
    ...asset,
    url: `${MOONSHINE_RUNTIME_ROOT}${asset.file}`,
  })),
];
