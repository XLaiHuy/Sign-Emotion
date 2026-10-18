/** Bounded local file decoding; never opens a microphone or uploads media. */
export async function decodeLocalAudio(file: File, signal: AbortSignal) {
  signal.throwIfAborted();
  if (file.size > 10 * 1024 * 1024) throw new Error('Chọn audio không quá 10 MiB.');
  const context = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await context.decodeAudioData(await file.arrayBuffer());
  } finally {
    await context.close().catch(() => {});
  }
  signal.throwIfAborted();
  if (decoded.duration < 0.3 || decoded.duration > 30)
    throw new Error('Chọn audio từ 0,3 đến 30 giây.');
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  try {
    const rendered = await offline.startRendering();
    signal.throwIfAborted();
    return rendered.getChannelData(0).slice();
  } finally {
    source.disconnect();
  }
}
