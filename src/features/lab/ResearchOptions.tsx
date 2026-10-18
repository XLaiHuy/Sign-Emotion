import { useEffect, useRef, useState } from 'react';
import faceBenchmarkWorkerUrl from '../../infrastructure/inference/face-benchmark.worker.ts?worker&url';
import toneBenchmarkWorkerUrl from '../../infrastructure/inference/tone-benchmark.worker.ts?worker&url';
import type { AsrProfileId } from '../../domain/asr';
import type { FaceModelProfile } from '../../infrastructure/inference/face-model-profile';
import { conversationProfile } from '../../infrastructure/inference/conversationProfile';
import { emitAudit } from '../../infrastructure/audit/log';
import {
  readProsodyArtifact,
  type ProsodyArtifact,
} from '../../infrastructure/inference/prosody-model';

export function useLabResearch() {
  const [asr, setAsr] = useState<AsrProfileId>(conversationProfile().asr);
  const [face, setFace] = useState<FaceModelProfile>(conversationProfile().face);
  const [weights, setWeights] = useState(1);
  const [manifest, setManifest] = useState<File | null>(null);
  const [model, setModel] = useState<File | null>(null);
  const [tone, setTone] = useState<ProsodyArtifact | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    setTone(null);
    setError('');
    if (!manifest || !model) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void readProsodyArtifact(manifest, model)
      .then((artifact) => {
        if (active) setTone(artifact);
      })
      .catch(() => {
        if (active)
          setError('Gói tone không hợp lệ. Kiểm tra manifest, thứ tự đặc trưng và checksum.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [manifest, model]);
  return {
    asr,
    setAsr,
    face,
    setFace,
    weights,
    setWeights,
    tone,
    error,
    loading,
    setManifest,
    setModel,
  };
}
export function ResearchOptions({
  research,
  disabled = false,
  onBusy,
}: {
  research: ReturnType<typeof useLabResearch>;
  disabled?: boolean;
  onBusy?: (busy: boolean) => void;
}) {
  const probeWorker = useRef<Worker | null>(null);
  const toneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const probeAbort = useRef<AbortController | null>(null);
  const [probe, setProbe] = useState('');
  const [probing, setProbing] = useState(false);
  const setProbeBusy = (value: boolean) => {
    setProbing(value);
    onBusy?.(value);
  };
  const benchmarkTone = (backend: 'wasm' | 'webgpu-fp32' = 'wasm') => {
    if (probing || disabled) return;
    const modelProfile =
      backend === 'wasm' ? 'emotion2vec-base-int8-research' : 'emotion2vec-base-fp32-gpu-research';
    setProbeBusy(true);
    setProbe('Đang kiểm tra tone đa ngôn ngữ thử nghiệm…');
    emitAudit('tone-probe-started', {
      branch: 'voice',
      modelProfile,
    });
    const worker = new Worker(toneBenchmarkWorkerUrl, { type: 'module' });
    probeWorker.current = worker;
    const timeout = setTimeout(() => {
      if (probeWorker.current !== worker) return;
      worker.terminate();
      probeWorker.current = null;
      setProbeBusy(false);
      setProbe('Tone thử nghiệm xử lý quá lâu.');
      emitAudit('tone-probe-failed', { branch: 'voice', reason: 'timeout' });
    }, 180000);
    toneTimer.current = timeout;
    const complete = (ok: boolean, rows: { processingMs: number }[] = []) => {
      if (probeWorker.current !== worker) return;
      clearTimeout(timeout);
      toneTimer.current = null;
      worker.terminate();
      probeWorker.current = null;
      setProbeBusy(false);
      emitAudit(ok ? 'tone-probe-completed' : 'tone-probe-failed', {
        branch: 'voice',
        modelProfile,
        ...(ok ? { durationMs: rows.at(-1)?.processingMs } : { reason: 'worker-failed' as const }),
      });
      setProbe(
        ok
          ? `Tone đã chạy; đoạn 3 giây: ${rows.at(-1)?.processingMs.toFixed(0)} ms. Chưa đánh giá tiếng Việt.`
          : 'Tone chưa chạy được trên trình duyệt này. Phụ đề không bị ảnh hưởng.',
      );
    };
    worker.onerror = () => complete(false);
    worker.onmessage = ({ data }) => complete(data.type === 'result', data.rows);
    worker.postMessage({ type: 'benchmark', backend });
  };
  useEffect(() => {
    const stop = () => {
      probeAbort.current?.abort();
      probeAbort.current = null;
      if (toneTimer.current) clearTimeout(toneTimer.current);
      toneTimer.current = null;
      probeWorker.current?.terminate();
      probeWorker.current = null;
      setProbeBusy(false);
    };
    const hide = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      stop();
    };
  }, []);
  const benchmark = async () => {
    if (probing || disabled) return;
    setProbeBusy(true);
    setProbe('Đang đối chiếu tensor và đo classifier…');
    let worker: Worker | null = null;
    const controller = new AbortController();
    probeAbort.current = controller;
    toneTimer.current = setTimeout(() => controller.abort(), 90000);
    try {
      worker = new Worker(faceBenchmarkWorkerUrl, { type: 'module' });
      probeWorker.current = worker;
      const response = await fetch('/research/face-parity/manifest.json', {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Missing fixture');
      const fixtures = await response.json();
      const fixture = fixtures.profiles.find(
        (item: { profile: string }) =>
          item.profile === (research.face.startsWith('b0-') ? 'b0' : 'b2'),
      );
      if (!fixture) throw new Error('Missing fixture');
      const rgbaResponse = await fetch(fixture.rgba, { signal: controller.signal });
      if (!rgbaResponse.ok) throw new Error('Missing fixture');
      const rgba = new Uint8Array(await rgbaResponse.arrayBuffer());
      if (probeWorker.current !== worker) return;
      controller.signal.throwIfAborted();
      const result = await new Promise<{ durations: number[]; logits: number[] }>(
        (resolve, reject) => {
          const stop = () => reject(new DOMException('Cancelled', 'AbortError'));
          controller.signal.addEventListener('abort', stop, { once: true });
          worker!.onerror = () => {
            controller.signal.removeEventListener('abort', stop);
            reject(new Error('Worker failed'));
          };
          worker!.onmessage = ({ data }) => {
            controller.signal.removeEventListener('abort', stop);
            if (data.type === 'error') reject(new Error('Probe failed'));
            else resolve(data);
          };
          worker!.postMessage({ type: 'benchmark', profile: research.face, rgba }, [rgba.buffer]);
        },
      );
      if (probeWorker.current !== worker) return;
      const ordered = result.durations.sort((a, b) => a - b);
      const difference = Math.max(
        ...result.logits.map((value, index) => Math.abs(value - fixture.logits[index])),
      );
      setProbe(
        `Classifier p50 ${ordered[14].toFixed(0)} ms · p95 ${ordered[28].toFixed(0)} ms · sai khác tensor ${difference.toExponential(2)}. Không đo accuracy hoặc toàn pipeline.`,
      );
    } catch {
      if (probeWorker.current === worker)
        setProbe(
          'Chưa đo được. Chuẩn bị fixture lab local trước; bản thường không tải gói nghiên cứu.',
        );
    } finally {
      worker?.terminate();
      if (probeAbort.current === controller) {
        controller.abort();
        probeAbort.current = null;
        if (toneTimer.current) clearTimeout(toneTimer.current);
        toneTimer.current = null;
      }
      if (probeWorker.current === worker) {
        probeWorker.current = null;
        setProbeBusy(false);
      }
    }
  };
  return (
    <details className="lab-research-options">
      <summary>Model nghiên cứu</summary>
      <p className="fine-note">
        Chọn profile trước khi chọn video. Chỉ xử lý local; model nghiên cứu chưa được công nhận đạt
        chất lượng sản phẩm.
      </p>
      <label className="field">
        ASR
        <select
          value={research.asr}
          disabled={disabled}
          onChange={(event) => research.setAsr(event.target.value as AsrProfileId)}
        >
          <option value="product">PhoWhisper — profile hiện tại</option>
          <option value="phowhisper">PhoWhisper — không fallback</option>
          <option value="whisper-baseline">Whisper tiny — đối chứng</option>
          <option value="gipformer-research">Gipformer 1.5 INT8 — nghiên cứu</option>
        </select>
      </label>
      <p className="fine-note">
        Tone chưa có trọng số tiếng Việt được nghiệm thu. Có thể nạp artifact do toolchain nghiên
        cứu xuất:
      </p>
      <label className="field">
        Khuôn mặt
        <select
          value={research.face}
          disabled={disabled}
          onChange={(event) => research.setFace(event.target.value as FaceModelProfile)}
        >
          <option value="product" disabled={conversationProfile().id === 'pc-candidate'}>
            EmotiEffLib B2 — baseline riêng
          </option>
          <option
            value="emotieff-b2-research"
            disabled={conversationProfile().id === 'pc-candidate'}
          >
            EmotiEffLib B2 — nghiên cứu local
          </option>
          <option value="b0-wasm-research">B0 / WASM — đối chứng</option>
          <option value="b0-webgpu-research">B0 / WebGPU — nghiên cứu</option>
          <option value="b2-webgpu-research" disabled={conversationProfile().id === 'pc-candidate'}>
            B2 / WebGPU — nghiên cứu
          </option>
        </select>
      </label>
      <button
        className="button secondary"
        disabled={disabled || probing}
        onClick={() => void benchmark()}
      >
        Đo classifier đã chọn
      </button>
      <button
        className="button secondary"
        disabled={disabled || probing}
        onClick={() => benchmarkTone()}
      >
        Kiểm tra tone đa ngôn ngữ thử nghiệm
      </button>
      <button
        className="button secondary"
        disabled={disabled || probing}
        onClick={() => benchmarkTone('webgpu-fp32')}
      >
        Kiểm tra tone trên GPU — file lớn
      </button>
      <p className="fine-note">
        Tone GPU có thể bật thử riêng trong Hội thoại. INT8 còn sai khác reference; chưa nghiệm thu
        độ chính xác tiếng Việt hoặc hiệu năng toàn pipeline.
      </p>
      {probe && (
        <p role="status" className="fine-note">
          {probe}
        </p>
      )}
      <label className="field">
        Manifest tone JSON
        <input
          type="file"
          accept=".json"
          disabled={disabled}
          onChange={(event) => research.setManifest(event.target.files?.[0] ?? null)}
        />
      </label>
      <label className="field">
        Model tone ONNX, tối đa 5 MiB
        <input
          type="file"
          accept=".onnx"
          disabled={disabled}
          onChange={(event) => research.setModel(event.target.files?.[0] ?? null)}
        />
      </label>
      {research.tone && (
        <label className="field">
          Trọng số thử nghiệm: mặt / text / tone
          <select
            value={research.weights}
            disabled={disabled}
            onChange={(event) => research.setWeights(Number(event.target.value))}
          >
            <option value={0}>Bằng nhau</option>
            <option value={1}>20 / 40 / 40</option>
            <option value={2}>20 / 50 / 30</option>
            <option value={3}>20 / 30 / 50</option>
          </select>
        </label>
      )}
      {research.loading && <p role="status">Đang kiểm tra gói tone…</p>}
      {research.tone && <p role="status">Gói tone đã kiểm tra checksum; chỉ dùng nghiên cứu.</p>}
      {research.error && (
        <p className="notice warning" role="alert">
          {research.error}
        </p>
      )}
    </details>
  );
}
