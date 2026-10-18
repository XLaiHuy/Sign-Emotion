import { extractProsody, PROSODY_FEATURES } from '../src/domain/prosody.ts';
const buffers = [];
let bytes = 0;
for await (const chunk of process.stdin) {
  bytes += chunk.length;
  if (bytes > 16000 * 10 * 4) throw new Error('PCM research input exceeds ten seconds');
  buffers.push(chunk);
}
const input = Buffer.concat(buffers);
if (!input.length || input.length % 4)
  throw new Error('Expected mono Float32 little-endian PCM, 16 kHz');
const samples = new Float32Array(input.length / 4);
for (let i = 0; i < samples.length; i++) samples[i] = input.readFloatLE(i * 4);
process.stdout.write(
  JSON.stringify({ ...extractProsody(samples), featureNames: PROSODY_FEATURES }),
);
