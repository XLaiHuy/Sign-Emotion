import { eligibleSignAsset, type SignAsset } from '../../domain/sign/signAsset';

/** Assets are local, bounded and verified before playback; no media is uploaded. */
export async function readSignAsset(asset: SignAsset, signal: AbortSignal) {
  if (!eligibleSignAsset(asset)) throw new Error('Unavailable sign asset');
  const response = await fetch(asset.url, {
    signal,
    credentials: 'same-origin',
    redirect: 'error',
  });
  if (!response.ok || !response.body) throw new Error('Missing sign asset');
  const limit = 16 * 1024 * 1024;
  if (Number(response.headers.get('content-length')) > limit)
    throw new Error('Sign asset too large');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) throw new Error('Sign asset too large');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const checksum = Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join(
    '',
  );
  if (checksum !== asset.sha256 || signal.aborted) throw new Error('Invalid sign asset');
  if (asset.kind === 'glb') {
    const view = new DataView(bytes.buffer);
    if (
      length < 20 ||
      view.getUint32(0, true) !== 0x46546c67 ||
      view.getUint32(4, true) !== 2 ||
      view.getUint32(8, true) !== length ||
      view.getUint32(16, true) !== 0x4e4f534a
    )
      throw new Error('Invalid GLB');
    const json = JSON.parse(
      new TextDecoder().decode(bytes.subarray(20, 20 + view.getUint32(12, true))),
    );
    if (
      [...(json.buffers ?? []), ...(json.images ?? [])].some(
        (item: { uri?: string }) => item.uri && !item.uri.startsWith('data:'),
      )
    )
      throw new Error('External sign dependency');
    if (!json.animations?.length || !json.skins?.length)
      throw new Error('No rigged sign animation');
    if (
      asset.clipName &&
      !json.animations.some((clip: { name?: string }) => clip.name === asset.clipName)
    )
      throw new Error('Wrong animation');
  } else if (!response.headers.get('content-type')?.startsWith('video/'))
    throw new Error('Not a video');
  return bytes.buffer;
}
