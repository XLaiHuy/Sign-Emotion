import { StreamingResampler } from '../../domain/audio';
declare const sampleRate: number;
declare const currentFrame: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare function registerProcessor(name: string, processor: typeof AudioWorkletProcessor): void;
class CaptureProcessor extends AudioWorkletProcessor {
  private resampler = new StreamingResampler(sampleRate);
  private frame = new Float32Array(512);
  private filled = 0;
  private offset = 0;
  private mono = new Float32Array(128);
  private resampled = new Float32Array(128);
  process(inputs: Float32Array[][], outputs: Float32Array[][] = []) {
    const channels = inputs[0];
    // An inactive/silent upstream may expose no channels. Its render quantum
    // still occupies media time: feed silence so VAD and sample offsets keep time.
    const length = channels?.[0]?.length ?? outputs[0]?.[0]?.length ?? 128;
    if (this.mono.length !== length) this.mono = new Float32Array(length);
    const mono = this.mono;
    mono.fill(0);
    const gain = 1 / Math.max(1, channels?.length ?? 0);
    for (const channel of channels ?? [])
      for (let i = 0; i < mono.length; i++) mono[i] += channel[i] * gain;
    const capacity = this.resampler.outputCapacity(mono.length);
    if (capacity > this.resampled.length) this.resampled = new Float32Array(capacity);
    const written = this.resampler.pushInto(mono, this.resampled);
    for (let i = 0; i < written; i++) {
      const value = this.resampled[i];
      this.frame[this.filled++] = value;
      if (this.filled === 512) {
        this.port.postMessage(
          {
            samples: this.frame,
            offset: this.offset,
            contextEndSeconds: (currentFrame + mono.length) / sampleRate,
          },
          [this.frame.buffer],
        );
        this.offset += 512;
        this.frame = new Float32Array(512);
        this.filled = 0;
      }
    }
    return true;
  }
}
registerProcessor('signemo-capture', CaptureProcessor);
