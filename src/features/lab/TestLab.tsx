import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import {
  defaultSettings,
  expressionUI,
  MODEL_VERSION,
  type CalibrationProfile,
  type InferenceResult,
  type Settings,
} from '../../shared/contracts';
import {
  FEATURE_NAMES,
  DETECTOR_SHA256,
  readAuxiliary,
  type AuxiliaryArtifact,
} from '../../infrastructure/inference/auxiliary';
import { downloadJson } from '../../infrastructure/backend/reports';
import {
  evaluateRows,
  evaluationCsv,
  referenceAt,
  referenceLabels,
  segmentsSchema,
  type EvaluationRow,
  type Segment,
} from '../../domain/evaluation';
import { PredictionGate, emptyResult } from '../../domain/face/prediction';
import { InferenceClient, seekVideo } from '../../infrastructure/inference/videoInference';
import { Diagnostics, resultExplanation } from '../face/Diagnostics';
import { SynchronizedVideoTest } from './SynchronizedVideoTest';
import {
  compareVideoFaces,
  type FaceComparisonResult,
} from '../../infrastructure/inference/faceComparison';
import { emitAudit } from '../../infrastructure/audit/log';

const profileSchema = z
  .object({
    thresholds: z.partialRecord(
      z.enum(['neutral', 'sad', 'happy', 'angry', 'surprised', 'fear', 'disgust']),
      z.number().min(0.5).max(0.99),
    ),
    margins: z.partialRecord(
      z.enum(['neutral', 'sad', 'happy', 'angry', 'surprised', 'fear', 'disgust']),
      z.number().min(0).max(1),
    ),
  })
  .strict();
type FeatureFrame = { timeMs: number; features: number[]; ferScores: number[] };
export function TestLab({
  settings,
  onNotice,
  onCandidate,
}: {
  settings: Settings;
  onNotice: (v: string) => void;
  onCandidate: (v: AuxiliaryArtifact | null) => void;
}) {
  const [faceComparison, setFaceComparison] = useState<FaceComparisonResult[]>([]);
  const [comparingProfile, setComparingProfile] = useState('');
  const video = useRef<HTMLVideoElement>(null),
    client = useRef<InferenceClient | null>(null),
    generation = useRef(0),
    inFlight = useRef(false),
    batch = useRef(false),
    abort = useRef<AbortController | null>(null);
  const blobUrl = useRef(''),
    rowsRef = useRef<EvaluationRow[]>([]),
    features = useRef<FeatureFrame[]>([]);
  const [src, setSrc] = useState(''),
    [duration, setDuration] = useState(0),
    [segments, setSegments] = useState<Segment[]>([]),
    [rows, setRows] = useState<EvaluationRow[]>([]);
  const [start, setStart] = useState(0),
    [end, setEnd] = useState(1),
    [label, setLabel] = useState<Segment['label']>('sad');
  const [result, setResult] = useState<InferenceResult>(emptyResult()),
    [state, setState] = useState('idle'),
    [progress, setProgress] = useState(0);
  const [manifestFile, setManifestFile] = useState<File | null>(null),
    [modelFile, setModelFile] = useState<File | null>(null),
    [candidate, setCandidate] = useState<AuxiliaryArtifact | null>(null),
    [useCandidate, setUseCandidate] = useState(false),
    [profile, setProfile] = useState<CalibrationProfile | undefined>();
  const [research, setResearch] = useState(false),
    [participant, setParticipant] = useState(''),
    [split, setSplit] = useState<'train' | 'validation' | 'test'>('train'),
    [expiry, setExpiry] = useState(() =>
      new Date(Date.now() + 29 * 86400_000).toISOString().slice(0, 10),
    );
  const researchSnapshot = useRef<{
    participantId: string;
    split: string;
    expiresAt: string;
    consentedAt: string;
  } | null>(null);
  const gate = useRef(new PredictionGate(settings));
  const stop = () => {
    setComparingProfile('');
    generation.current++;
    batch.current = false;
    abort.current?.abort();
    client.current?.close();
    client.current = null;
    video.current?.pause();
    gate.current.reset();
    setState('idle');
    setResult(emptyResult());
  };
  const stopRef = useRef(stop);
  stopRef.current = stop;
  useEffect(() => {
    stopRef.current();
    setFaceComparison([]);
  }, [settings, candidate, useCandidate, profile]);
  useEffect(() => setFaceComparison([]), [segments]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) stopRef.current();
    };
    const end = () => stopRef.current();
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', end);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', end);
      stopRef.current();
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    };
  }, []);
  const getClient = () => {
    client.current ??= new InferenceClient(useCandidate && candidate ? candidate : undefined, true);
    return client.current;
  };
  const preview = async () => {
    if (batch.current) return;
    const token = ++generation.current;
    gate.current = new PredictionGate(settings, profile);
    setState('preview');
    try {
      const engine = getClient();
      await engine.ready;
      while (
        token === generation.current &&
        video.current &&
        !video.current.paused &&
        !batch.current
      ) {
        if (inFlight.current || video.current.seeking || video.current.readyState < 2) {
          await new Promise((r) => setTimeout(r, 100));
          continue;
        }
        inFlight.current = true;
        try {
          const input = await engine.infer(video.current, video.current.currentTime * 1000);
          if (token !== generation.current) break;
          const gated = gate.current.update(input);
          setResult(gated.result);
        } finally {
          inFlight.current = false;
        }
        await new Promise((r) => setTimeout(r, 200));
      }
    } catch (error) {
      if (token === generation.current) {
        stop();
        onNotice(error instanceof Error ? error.message : 'Không xử lý được video');
      }
    }
  };
  const run = async () => {
    stop();
    const element = video.current;
    if (!element || !Number.isFinite(duration) || duration <= 0) return;
    if (
      research &&
      (!/^[A-Za-z0-9_-]{1,40}$/.test(participant) ||
        !expiry ||
        Date.parse(expiry + 'T23:59:59Z') <= Date.now() ||
        Date.parse(expiry + 'T23:59:59Z') > Date.now() + 30 * 86400_000)
    ) {
      onNotice('Nghiên cứu cần mã giả danh và ngày hết hạn trong 30 ngày tới.');
      return;
    }
    if (duration > 7200) {
      onNotice('Hãy dùng clip ngắn hơn 2 giờ để giới hạn bộ nhớ kiểm thử.');
      return;
    }
    const token = ++generation.current,
      controller = new AbortController();
    abort.current = controller;
    batch.current = true;
    element.pause();
    setState('batch');
    setProgress(0);
    rowsRef.current = [];
    features.current = [];
    setRows([]);
    gate.current = new PredictionGate(settings, profile);
    researchSnapshot.current = research
      ? {
          participantId: participant,
          split,
          expiresAt: expiry + 'T23:59:59Z',
          consentedAt: new Date().toISOString(),
        }
      : null;
    try {
      const engine = getClient();
      await engine.ready;
      for (let i = 0; i < Math.ceil(duration * 5); i++) {
        controller.signal.throwIfAborted();
        if (token !== generation.current) break;
        const timeMs = i * 200;
        await seekVideo(
          element,
          Math.min(timeMs / 1000, Math.max(0, duration - 0.001)),
          controller.signal,
        );
        const input = await engine.infer(element, timeMs, research);
        if (token !== generation.current) break;
        const gated = gate.current.update(input);
        rowsRef.current.push({
          timeMs,
          rawScores: input.scores,
          smoothedScores: gated.result.scores,
          predicted: gated.result.label ?? 'uncertain',
          status: gated.result.status,
          reason: gated.result.qualityReason ?? gated.result.decisionReason ?? '',
          processingMs: input.processingMs,
          trigger: gated.trigger,
          auxiliaryScores: input.auxiliary?.scores,
        });
        if (research && input.features)
          features.current.push({ timeMs, features: input.features, ferScores: input.scores });
        // Never keep research features in general-purpose diagnostic state/logs.
        const { features: _features, ...diagnostic } = gated.result;
        setResult(diagnostic);
        if (i % 5 === 0) {
          setRows([...rowsRef.current]);
          setProgress(Math.round(((i + 1) / (duration * 5)) * 100));
        }
      }
      if (token === generation.current) {
        setRows([...rowsRef.current]);
        setProgress(100);
        setState('done');
        onNotice('Đã đánh giá 5 mẫu/giây. Không phát motor trong chế độ này.');
      }
    } catch (error) {
      if (token === generation.current) {
        setState('idle');
        onNotice(error instanceof Error ? error.message : 'Không xử lý được video');
      }
    } finally {
      if (token === generation.current) {
        batch.current = false;
        setRows([...rowsRef.current]);
      }
    }
  };
  const chooseFile = (file?: File) => {
    stop();
    setFaceComparison([]);
    rowsRef.current = [];
    features.current = [];
    researchSnapshot.current = null;
    setRows([]);
    setSegments([]);
    setDuration(0);
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    blobUrl.current = '';
    setSrc('');
    if (!file) return;
    if (!/\.(mp4|webm)$/i.test(file.name)) {
      onNotice('Chọn file MP4 hoặc WebM. Codec còn phụ thuộc trình duyệt.');
      return;
    }
    blobUrl.current = URL.createObjectURL(file);
    setSrc(blobUrl.current);
  };
  const addSegment = () => {
    try {
      const next = segmentsSchema.parse([
        ...segments,
        { startMs: Math.round(start * 1000), endMs: Math.round(end * 1000), label },
      ]);
      if (next.some((s) => s.endMs > duration * 1000 + 1))
        throw new Error('Đoạn nhãn vượt thời lượng video');
      setSegments(next.sort((a, b) => a.startMs - b.startMs));
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Đoạn nhãn không hợp lệ');
    }
  };
  const summary = evaluateRows(rows, segments);
  const compareFaces = async () => {
    stop();
    const element = video.current;
    if (!element || !duration) return;
    const token = generation.current;
    const controller = new AbortController();
    abort.current = controller;
    batch.current = true;
    element.pause();
    setState('batch');
    setFaceComparison([]);
    setProgress(0);
    emitAudit('model-comparison-started', { branch: 'face', count: 3 });
    try {
      const reports = await compareVideoFaces(
        element,
        duration,
        settings,
        profile,
        segments,
        controller.signal,
        (engine) => {
          if (token === generation.current) client.current = engine;
        },
        (model, percent) => {
          if (token === generation.current) {
            setComparingProfile(model);
            setProgress(percent);
          }
        },
      );
      if (token !== generation.current) return;
      setFaceComparison(reports);
      setState('done');
      emitAudit('model-comparison-completed', {
        branch: 'face',
        count: reports.filter((r) => r.status === 'ok').length,
      });
    } catch {
      if (token === generation.current) {
        setState('idle');
        onNotice('Chưa hoàn tất so sánh mặt. Kiểm tra gói lab rồi thử lại.');
        emitAudit('model-comparison-failed', { branch: 'face', reason: 'worker-failed' });
      }
    } finally {
      if (token === generation.current) {
        batch.current = false;
        setComparingProfile('');
      }
    }
  };
  const exportResearch = () => {
    const consent = researchSnapshot.current;
    if (!research || !consent || Date.parse(consent.expiresAt) <= Date.now()) {
      onNotice('Cần đồng ý nghiên cứu còn hiệu lực và chạy lại đánh giá.');
      return;
    }
    const featureMap = new Map(features.current.map((f) => [f.timeMs, f.features]));
    const frames = rowsRef.current.map((r) => ({
      timeMs: r.timeMs,
      features: featureMap.get(r.timeMs) ?? null,
      ferScores: r.rawScores,
      label: referenceAt(r.timeMs, segments),
    }));
    if (!frames.some((f) => f.label !== 'ignore' && f.features)) {
      onNotice('Chưa có frame có nhãn và đặc trưng hợp lệ.');
      return;
    }
    downloadJson('signemo-research.json', {
      schemaVersion: 1,
      ...consent,
      trainingConsent: true,
      encryptedStorageConfirmed: true,
      detectorSha256: DETECTOR_SHA256,
      featureNames: FEATURE_NAMES,
      baselineModel: MODEL_VERSION,
      settings,
      frames,
    });
  };
  const busy = state === 'batch';
  return (
    <>
      <div className="standard-heading">
        <div className="eyebrow">DÀNH CHO CHỦ DỰ ÁN</div>
        <h1>Phòng kiểm thử</h1>
        <p>
          Video được xử lý trên thiết bị. Kết quả là gợi ý quan sát, không khẳng định cảm xúc thật.
        </p>
      </div>
      <details className="card settings-card">
        <summary>Ký hiệu câu TP.HCM · nghiên cứu</summary>
        <p>
          Chưa có câu được duyệt để phát bằng avatar. Đã khảo sát VSL-GH và lưu hai mẫu keypoint
          public để đánh giá offline; chưa xác minh biến thể TP.HCM, nghĩa và chuyển động tay/ngón.
        </p>
        <p>
          Chỉ mẫu được kiểm chứng đầy đủ mới có thể xuất hiện cạnh câu phụ đề. Không dùng ký hiệu
          ASL thay cho tiếng Việt hoặc tự ghép động tác thiếu.
        </p>
      </details>
      <SynchronizedVideoTest settings={settings} />
      <details className="card lab-advanced">
        <summary>Đánh giá theo nhãn và công cụ nghiên cứu</summary>
        <div className="lab-grid">
          <section className="card settings-card">
            <h2>Video cục bộ</h2>
            <label className="field">
              Chọn MP4/WebM
              <input
                type="file"
                accept="video/mp4,video/webm,.mp4,.webm"
                onChange={(e) => chooseFile(e.target.files?.[0])}
              />
            </label>
            {src && (
              <video
                className="lab-video"
                ref={video}
                src={src}
                controls={!busy}
                muted
                playsInline
                onLoadedMetadata={(e) => {
                  const d = e.currentTarget.duration;
                  if (!Number.isFinite(d) || d <= 0) {
                    onNotice('Video không có thời lượng hợp lệ');
                    return;
                  }
                  setDuration(d);
                  setEnd(Math.min(1, d));
                }}
                onError={() => {
                  stop();
                  onNotice(
                    'Không đọc được video. Thử MP4 H.264 hoặc WebM được trình duyệt hỗ trợ.',
                  );
                }}
                onPlay={() => void preview()}
                onPause={() => {
                  if (!batch.current) {
                    generation.current++;
                    gate.current.reset();
                    setState('idle');
                  }
                }}
                onSeeking={() => {
                  if (!batch.current) {
                    generation.current++;
                    gate.current.reset();
                    setResult(emptyResult());
                  }
                }}
                onSeeked={() => {
                  if (!batch.current && video.current && !video.current.paused) void preview();
                }}
              />
            )}
            <div className="lab-actions">
              <button
                className="button primary"
                disabled={!duration || busy}
                onClick={() => void run()}
              >
                Đánh giá tuần tự 5 mẫu/giây
              </button>
              <button className="button secondary" onClick={stop}>
                Dừng xử lý
              </button>
              <button
                className="button secondary"
                disabled={!duration || busy || state === 'preview'}
                onClick={() => void compareFaces()}
              >
                So sánh các cấu hình mặt đã đóng gói
              </button>
            </div>
            <p className="fine-note">
              So sánh tối đa 30 giây đầu, cùng mốc 200 ms và cùng bộ lọc. Chưa có nhãn thì chỉ đo
              tốc độ; cần gói lab local. Không phát nhịp.
            </p>
            {comparingProfile && (
              <p role="status">
                {comparingProfile} · {progress}%
              </p>
            )}
            {faceComparison.length > 0 && (
              <>
                {faceComparison.map((row) => (
                  <div key={row.profile}>
                    <strong>{row.profile}</strong>
                    {row.status === 'unavailable' ? (
                      <p>Không khả dụng; không đổi backend ngầm.</p>
                    ) : (
                      <>
                        <p>
                          {row.samples} mẫu · capture → kết quả p95{' '}
                          {row.captureToResult?.p95Ms?.toFixed(0) ?? '—'} ms · lượt đầu{' '}
                          {row.coldMs?.toFixed(0)} ms
                        </p>
                        <p>
                          Detection p95 {row.detection?.p95Ms?.toFixed(0) ?? '—'} ms · crop{' '}
                          {row.crop?.p95Ms?.toFixed(0) ?? '—'} ms · classifier{' '}
                          {row.classifier?.p95Ms?.toFixed(0) ?? '—'} ms (
                          {row.classifier?.samples ?? 0} mẫu thực sự chạy classifier)
                        </p>
                        {row.quality ? (
                          <details>
                            <summary>
                              Precision/Recall và ma trận nhầm lẫn theo nhãn đã nhập
                            </summary>
                            <pre className="lab-comparison-json">
                              {JSON.stringify(row.quality, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <p>Chưa có nhãn tham chiếu: không báo accuracy/F1.</p>
                        )}
                      </>
                    )}
                  </div>
                ))}
                <button
                  className="text-button"
                  onClick={() =>
                    downloadJson('signemo-face-comparison.json', {
                      schemaVersion: 1,
                      createdAt: new Date().toISOString(),
                      buildId: import.meta.env.VITE_BUILD_ID || 'development',
                      settings,
                      calibration: profile,
                      reports: faceComparison,
                      scope:
                        'same local video timestamps, first 30 seconds, batch 5 Hz; no media/landmarks/frame traces; no realtime FPS claim',
                    })
                  }
                >
                  Xuất số đo và thống kê mặt
                </button>
              </>
            )}
            <p role="status">
              {busy
                ? `Đang đánh giá ${progress}%`
                : state === 'done'
                  ? 'Đã hoàn thành'
                  : state === 'preview'
                    ? 'Đang phân tích khi phát video'
                    : 'Video không rời thiết bị'}{' '}
              · {rows.length} mẫu
            </p>
            <h3>{result.label ? expressionUI[result.label].description : 'Chưa xác định'}</h3>
            <p>{resultExplanation(result)}</p>
            <Diagnostics result={result} />
          </section>
          <section className="card settings-card">
            <h2>Nhãn theo từng đoạn</h2>
            <div className="lab-fields">
              <label className="field">
                Bắt đầu (giây)
                <input
                  type="number"
                  min="0"
                  step="0.2"
                  value={start}
                  onChange={(e) => setStart(Number(e.target.value))}
                />
              </label>
              <label className="field">
                Kết thúc (giây)
                <input
                  type="number"
                  min="0"
                  step="0.2"
                  value={end}
                  onChange={(e) => setEnd(Number(e.target.value))}
                />
              </label>
            </div>
            <button
              className="text-button"
              onClick={() => setStart(video.current?.currentTime ?? 0)}
            >
              Lấy thời điểm hiện tại làm bắt đầu
            </button>
            <button className="text-button" onClick={() => setEnd(video.current?.currentTime ?? 0)}>
              Lấy thời điểm hiện tại làm kết thúc
            </button>
            <label className="field">
              Nhãn tham chiếu
              <select value={label} onChange={(e) => setLabel(e.target.value as Segment['label'])}>
                {referenceLabels.map((l) => (
                  <option key={l} value={l}>
                    {l === 'ignore'
                      ? 'Bỏ qua / không đánh giá'
                      : l in expressionUI
                        ? expressionUI[l as keyof typeof expressionUI].name
                        : l}
                  </option>
                ))}
              </select>
            </label>
            <button className="button secondary" disabled={!duration || busy} onClick={addSegment}>
              Thêm đoạn
            </button>
            <ul className="segment-list">
              {segments.map((s, i) => (
                <li key={i}>
                  {s.startMs / 1000}–{s.endMs / 1000}s · {s.label}
                  <button
                    disabled={busy}
                    className="text-button danger"
                    onClick={() => setSegments((v) => v.filter((_, j) => j !== i))}
                  >
                    Xóa
                  </button>
                </li>
              ))}
            </ul>
            <div className="lab-actions">
              <button
                className="button secondary"
                onClick={() => downloadJson('signemo-labels.json', segments)}
              >
                Xuất nhãn
              </button>
              <label className="field">
                Nhập nhãn JSON
                <input
                  type="file"
                  accept=".json"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file)
                      void file
                        .text()
                        .then((t) => {
                          const next = segmentsSchema.parse(JSON.parse(t));
                          if (next.some((s) => s.endMs > duration * 1000 + 1))
                            throw new Error('Nhãn vượt thời lượng video');
                          setSegments(next);
                        })
                        .catch(() => onNotice('File nhãn không hợp lệ hoặc có đoạn chồng lấn.'));
                  }}
                />
              </label>
            </div>
          </section>
        </div>
        <section className="card settings-card">
          <h2>Báo cáo đánh giá</h2>
          <p>
            {summary.labeledSamples > 0 ? (
              <>
                {summary.labeledSamples} mẫu có nhãn · Macro-F1 {summary.macroF1.toFixed(3)} · Không
                kết luận {(summary.uncertainRate * 100).toFixed(1)}% · Nhịp sai/phút{' '}
                {summary.falseTriggersPerMinute.toFixed(2)}
              </>
            ) : (
              'Chưa có mẫu có nhãn tham chiếu — chưa tính Precision/Recall/F1.'
            )}
          </p>
          <p className="fine-note">
            Chỉ số thời gian áp dụng cho lượt đánh giá tuần tự 5 Hz. Lớp thiếu dữ liệu có support =
            0; chưa đủ để kết luận model tốt hơn.
          </p>
          {summary.labeledSamples > 0 && (
            <div className="score-table">
              <table>
                <thead>
                  <tr>
                    <th>Lớp</th>
                    <th>Support</th>
                    <th>Precision</th>
                    <th>Recall</th>
                    <th>F1</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summary.perClass).map(([name, m]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>{m.support}</td>
                      <td>{m.precision.toFixed(3)}</td>
                      <td>{m.recall.toFixed(3)}</td>
                      <td>{m.f1.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="lab-actions">
            <button
              className="button secondary"
              disabled={!rows.length || busy}
              onClick={() =>
                downloadJson('signemo-evaluation.json', {
                  schemaVersion: 1,
                  modelVersion:
                    useCandidate && candidate
                      ? `${MODEL_VERSION}+${candidate.manifest.version}`
                      : MODEL_VERSION,
                  settings,
                  profile,
                  segments,
                  summary,
                  rows: rows.map((r) => ({ ...r, trueLabel: referenceAt(r.timeMs, segments) })),
                })
              }
            >
              Xuất JSON + confusion matrix
            </button>
            <button
              className="button secondary"
              disabled={!rows.length || busy}
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob(['\ufeff' + evaluationCsv(rows, segments)], {
                    type: 'text/csv;charset=utf-8',
                  }),
                );
                const a = document.createElement('a');
                a.href = url;
                a.download = 'signemo-evaluation.csv';
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              Xuất CSV
            </button>
          </div>
        </section>
        <section className="card settings-card">
          <h2>Model phụ neutral–sad và hiệu chỉnh</h2>
          <p>
            EmotiEffLib là model mặt hiện tại. Model phụ chưa qua đánh giá chỉ được chạy thử ở đây.
          </p>
          <div className="lab-fields">
            <label className="field">
              Manifest model (.json)
              <input
                disabled={busy}
                type="file"
                accept=".json"
                onChange={(e) => setManifestFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <label className="field">
              Model (.onnx)
              <input
                disabled={busy}
                type="file"
                accept=".onnx"
                onChange={(e) => setModelFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <button
            disabled={!manifestFile || !modelFile || busy}
            className="button secondary"
            onClick={() =>
              void readAuxiliary(manifestFile!, modelFile!)
                .then((m) => {
                  stop();
                  setCandidate(m);
                  onNotice('Đã kiểm tra checksum model phụ.');
                })
                .catch((e) => onNotice(e instanceof Error ? e.message : 'Gói model không hợp lệ'))
            }
          >
            Kiểm tra và nạp model phụ
          </button>
          {candidate && (
            <>
              <p>
                {candidate.manifest.version} ·{' '}
                {candidate.manifest.approved
                  ? 'Đạt điều kiện đánh giá đã khai báo'
                  : 'Thử nghiệm; chưa được bật cho camera'}
              </p>
              <label className="checkbox-label">
                <input
                  disabled={busy}
                  type="checkbox"
                  checked={useCandidate}
                  onChange={(e) => setUseCandidate(e.target.checked)}
                />
                Dùng model phụ trong phòng kiểm thử
              </label>
              <button
                disabled={!candidate.manifest.approved || busy}
                className="button secondary"
                onClick={() => {
                  onCandidate(candidate);
                  onNotice(
                    'Camera sẽ dùng gói đã đánh giá trong phiên ứng dụng này. Mở lại cần nạp lại gói.',
                  );
                }}
              >
                Bật gói đã đánh giá cho camera
              </button>
            </>
          )}
          <button
            className="text-button"
            onClick={() => {
              onCandidate(null);
              onNotice('Đã bỏ model phụ; camera dùng EmotiEffLib.');
            }}
          >
            Camera dùng EmotiEffLib hiện tại
          </button>
          <label className="field">
            Nhập profile ngưỡng/margin (chỉ phòng kiểm thử)
            <input
              disabled={busy}
              type="file"
              accept=".json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f)
                  void f
                    .text()
                    .then((t) => setProfile(profileSchema.parse(JSON.parse(t))))
                    .catch(() => onNotice('Profile không hợp lệ.'));
              }}
            />
          </label>
          {profile && (
            <button className="text-button" onClick={() => setProfile(undefined)}>
              Bỏ profile hiệu chỉnh
            </button>
          )}
        </section>
        <section className="card settings-card">
          <h2>Xuất đặc trưng cho nghiên cứu riêng</h2>
          <p>
            Không cần bật mục này để kiểm thử. Chỉ dùng clip được đồng ý riêng cho huấn luyện; lưu
            file xuất trong vùng mã hóa offline, không đồng bộ cloud/Git. Mặc định giữ tối đa 30
            ngày.
          </p>
          <label className="checkbox-label">
            <input
              disabled={busy}
              type="checkbox"
              checked={research}
              onChange={(e) => {
                setResearch(e.target.checked);
                if (!e.target.checked) {
                  features.current = [];
                  researchSnapshot.current = null;
                }
              }}
            />
            Tôi có đồng ý riêng cho nghiên cứu/huấn luyện và đã chuẩn bị nơi lưu mã hóa offline.
          </label>
          {research && (
            <>
              <div className="lab-fields">
                <label className="field">
                  Mã giả danh người tham gia
                  <input
                    disabled={busy}
                    value={participant}
                    maxLength={40}
                    onChange={(e) => setParticipant(e.target.value)}
                  />
                </label>
                <label className="field">
                  Tập dữ liệu
                  <select
                    disabled={busy}
                    value={split}
                    onChange={(e) => setSplit(e.target.value as typeof split)}
                  >
                    <option value="train">Train</option>
                    <option value="validation">Validation</option>
                    <option value="test">Test — không dùng để chỉnh</option>
                  </select>
                </label>
                <label className="field">
                  Ngày hết hạn
                  <input
                    disabled={busy}
                    type="date"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                  />
                </label>
              </div>
              <button
                className="button secondary"
                disabled={busy || !features.current.length}
                onClick={exportResearch}
              >
                Xuất dataset đặc trưng đã gán nhãn
              </button>
              <p className="fine-note">
                Chạy lại đánh giá sau khi bật. Cùng một người phải luôn thuộc một tập; script huấn
                luyện kiểm tra lại điều này.
              </p>
            </>
          )}
        </section>
      </details>
      <p className="fine-note">
        Thiết lập mặc định: ngưỡng {defaultSettings.threshold}, ổn định {defaultSettings.dwellMs}{' '}
        ms, khoảng nghỉ {defaultSettings.cooldownMs} ms. Video/đặc trưng không tự lưu; đổi file hoặc
        rời phòng kiểm thử sẽ giải phóng bộ nhớ.
      </p>
    </>
  );
}
