export type FaceModelProfile =
  | 'product'
  | 'emotieff-b2-research'
  | 'b0-wasm-research'
  | 'b0-webgpu-research'
  | 'b2-webgpu-research';
export const B0_PROFILE = {
  version: 'emotiefflib-enet-b0-afew-research-v1',
  url: '/research/emotieff-b0/enet_b0_8_best_afew.onnx',
  bytes: 16039595,
  sha256: '7aa2ea31c1311f4f8aa9d3fdb085d418dd4e7a48c4b9ed41df8c044f91d0213f',
  size: 224,
} as const;
export const B2_PROFILE = {
  version: 'emotiefflib-enet-b2-8-research-v1',
  url: '/research/emotieff-b2/enet_b2_8.onnx',
  bytes: 30779724,
  sha256: '180a9d4845b59393de4511598a0d1d34b705034691ea32959ce5009db7cf52b7',
  size: 260,
} as const;

/** Alternate providers/checkpoints require an explicit experiment; baseline remains B2/WASM. */
export function faceProfileContract(profile: FaceModelProfile) {
  if (
    ![
      'product',
      'emotieff-b2-research',
      'b0-wasm-research',
      'b0-webgpu-research',
      'b2-webgpu-research',
    ].includes(profile)
  )
    throw new Error('Profile mặt không hợp lệ');
  return {
    ...(profile.startsWith('b0-') ? B0_PROFILE : B2_PROFILE),
    backend: profile.includes('webgpu') ? ('webgpu' as const) : ('wasm' as const),
  };
}
export async function loadResearchFaceModel(profile: FaceModelProfile = 'emotieff-b2-research') {
  const contract = faceProfileContract(profile);
  // Cache only an explicitly selected, checksum-verified research checkpoint.
  // Storage failure must not prevent inference on the downloaded bytes.
  const cache = await (typeof caches !== 'undefined'
    ? caches.open('signemo-research-face-v1').catch(() => null)
    : Promise.resolve(null));
  const verify = async (bytes: ArrayBuffer) => {
    if (bytes.byteLength !== contract.bytes) return false;
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (value) =>
      value.toString(16).padStart(2, '0'),
    ).join('');
    return hash === contract.sha256;
  };
  const cached = await cache?.match(contract.url).catch(() => undefined);
  if (cached) {
    const bytes = await cached.arrayBuffer();
    if (await verify(bytes)) return bytes;
    await cache?.delete(contract.url).catch(() => false);
  }
  const response = await fetch(contract.url);
  if (!response.ok) throw new Error('Gói mặt nghiên cứu chưa được chuẩn bị');
  const bytes = await response.arrayBuffer();
  if (!(await verify(bytes))) throw new Error('Sai checksum hoặc dung lượng gói mặt');
  await cache?.put(contract.url, new Response(bytes)).catch(() => {});
  return bytes;
}
