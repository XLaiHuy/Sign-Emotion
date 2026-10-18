import captureUrl from './capture.worklet?worker&url';
import { audioFrameStartMs, audioFrameGapMs } from '../../domain/audioClock';

export class MicrophoneCapture {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private generation = 0;
  stop() {
    this.generation++;
    this.node?.disconnect();
    if (this.node) this.node.port.onmessage = null;
    this.node = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    void this.context?.close().catch(() => {});
    this.context = null;
  }
  async start(
    onFrame: (
      samples: Float32Array,
      offset: number,
      capturedAtMs?: number,
      captureGapMs?: number,
    ) => void,
    onEnded: () => void,
    providedStream?: MediaStream,
    providedContext?: AudioContext,
  ) {
    this.stop();
    const generation = this.generation;
    if (!isSecureContext || !navigator.mediaDevices?.getUserMedia)
      throw new Error('Micro cần HTTPS hoặc localhost và trình duyệt hỗ trợ.');
    const stream =
      providedStream ??
      (await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
      }));
    if (generation !== this.generation) {
      stream.getTracks().forEach((t) => t.stop());
      return false;
    }
    if (!stream.getAudioTracks().length)
      throw new Error('Không tìm thấy micro trong luồng đã cấp quyền.');
    this.stream = stream;
    stream.getAudioTracks()[0].addEventListener('ended', onEnded, { once: true });
    const context = providedContext ?? new AudioContext();
    this.context = context;
    await context.audioWorklet.addModule(captureUrl);
    if (generation !== this.generation) return false;
    const node = new AudioWorkletNode(context, 'signemo-capture');
    this.node = node;
    const silent = context.createGain();
    silent.gain.value = 0;
    // Remove DC/subsonic rumble; avoid spectral gating that distorts tone.
    const dcFilter = context.createBiquadFilter();
    dcFilter.type = 'highpass';
    dcFilter.frequency.value = 20;
    dcFilter.Q.value = Math.SQRT1_2;
    context
      .createMediaStreamSource(stream)
      .connect(dcFilter)
      .connect(node)
      .connect(silent)
      .connect(context.destination);
    let previousContextEnd: number | undefined;
    node.port.onmessage = (event) => {
      if (generation !== this.generation) return;
      const now = performance.now();
      const timestamp =
        typeof context.getOutputTimestamp === 'function' ? context.getOutputTimestamp() : {};
      const stamp =
        (timestamp.performanceTime ?? 0) > 0
          ? timestamp
          : { contextTime: context.currentTime, performanceTime: now };
      const capturedAtMs = audioFrameStartMs(
        event.data.contextEndSeconds,
        stamp,
        event.data.samples.length,
      );
      const gapMs = audioFrameGapMs(
        event.data.contextEndSeconds,
        previousContextEnd,
        event.data.samples.length,
      );
      previousContextEnd = event.data.contextEndSeconds;
      onFrame(event.data.samples, event.data.offset, capturedAtMs, gapMs);
    };
    await context.resume();
    if (generation === this.generation && context.state !== 'running')
      throw new Error('Micro chưa hoạt động. Bấm bắt đầu lại để bật xử lý âm thanh.');
    return generation === this.generation;
  }
}
