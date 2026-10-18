import type { InferenceResult } from '../../shared/contracts';
import type { AuxiliaryArtifact } from './auxiliary';
import { faceProfileContract, type FaceModelProfile } from './face-model-profile';
import faceWorkerUrl from './face.worker.ts?worker&url';
import faceGpuWorkerUrl from './face-gpu.worker.ts?worker&url';
import { conversationProfile } from './conversationProfile';
export class InferenceClient {
  private worker: Worker;
  private pending: {
    resolve: (r: InferenceResult) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;
  private readyResolve!: () => void;
  private readyReject!: (e: Error) => void;
  private initTimer: ReturnType<typeof setTimeout>;
  private closed = false;
  private sequence = 0;
  private capturing = false;
  readonly ready: Promise<void>;
  constructor(
    candidate?: AuxiliaryArtifact,
    research = false,
    faceProfile: FaceModelProfile = 'product',
  ) {
    if (faceProfile === 'product' && conversationProfile().id === 'pc-candidate') {
      faceProfile = conversationProfile().face;
      research = true;
    }
    this.worker = new Worker(
      faceProfileContract(faceProfile).backend === 'webgpu' ? faceGpuWorkerUrl : faceWorkerUrl,
      { type: 'module' },
    );
    this.ready = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    this.initTimer = setTimeout(
      () => this.close(new Error('AI chưa sẵn sàng sau 90 giây')),
      90_000,
    );
    this.worker.onerror = () => this.close(new Error('Không khởi chạy được worker/model'));
    this.worker.onmessage = (e) => {
      if (e.data.type === 'ready') {
        clearTimeout(this.initTimer);
        this.readyResolve();
      }
      if (e.data.type === 'error') {
        this.close(new Error(e.data.message));
        return;
      }
      if (e.data.type === 'result' && this.pending && e.data.requestId === this.sequence) {
        const p = this.pending;
        this.pending = null;
        clearTimeout(p.timer);
        p.resolve(e.data.result);
      }
    };
    this.worker.postMessage({ type: 'init', candidate, research, faceProfile });
  }
  async infer(
    video: HTMLVideoElement,
    timeMs: number,
    captureFeatures = false,
  ): Promise<InferenceResult> {
    await this.ready;
    if (this.closed) throw new Error('Đã dừng AI');
    if (this.pending || this.capturing) throw new Error('Một lượt xử lý đang chạy');
    const width = Math.min(640, video.videoWidth),
      height = Math.round((video.videoHeight * width) / video.videoWidth);
    this.capturing = true;
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(video, { resizeWidth: width, resizeHeight: height });
    } finally {
      this.capturing = false;
    }
    if (this.closed) {
      bitmap.close();
      throw new Error('Đã dừng AI');
    }
    this.sequence++;
    return new Promise((resolve, reject) => {
      this.pending = {
        resolve,
        reject,
        timer: setTimeout(() => this.close(new Error('Xử lý khung hình quá lâu')), 12_000),
      };
      try {
        this.worker.postMessage(
          { type: 'frame', bitmap, timestamp: timeMs, requestId: this.sequence, captureFeatures },
          [bitmap],
        );
      } catch (error) {
        bitmap.close();
        this.close(error instanceof Error ? error : new Error('Không đọc được video'));
      }
    });
  }
  close(error = new Error('Đã dừng xử lý')) {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.initTimer);
    this.readyReject(error);
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(error);
      this.pending = null;
    }
    this.worker.terminate();
  }
}
export async function seekVideo(video: HTMLVideoElement, seconds: number, signal: AbortSignal) {
  signal.throwIfAborted();
  if (Math.abs(video.currentTime - seconds) < 0.0001 && video.readyState >= 2) return;
  await new Promise<void>((resolve, reject) => {
    const clean = () => {
      clearTimeout(timer);
      video.removeEventListener('seeked', done);
      video.removeEventListener('error', error);
      signal.removeEventListener('abort', abort);
    };
    const done = () => {
      clean();
      resolve();
    };
    const error = () => {
      clean();
      reject(new Error('Không giải mã được video'));
    };
    const abort = () => {
      clean();
      reject(new DOMException('Đã dừng', 'AbortError'));
    };
    const timer = setTimeout(() => {
      clean();
      reject(new Error('Tua video quá lâu'));
    }, 10_000);
    video.addEventListener('seeked', done, { once: true });
    video.addEventListener('error', error, { once: true });
    signal.addEventListener('abort', abort, { once: true });
    video.currentTime = seconds;
  });
}
