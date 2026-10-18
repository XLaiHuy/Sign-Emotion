import { useEffect, useRef, useState } from 'react';
import { PageTitle } from '../../shared/ui/PageTitle';
import { makeWorkerReady } from '../conversation/session';
import { speechError } from '../../domain/speechMetrics';
import type { ModalityEvidence, TranscriptSegment } from '../../domain/conversation';
import { downloadJson } from '../../infrastructure/backend/reports';
import { extractProsody } from '../../domain/prosody';
import { estimateFileAudioQuality } from '../../domain/audio';
import { ResearchOptions, useLabResearch } from './ResearchOptions';
import { emitAudit } from '../../infrastructure/audit/log';
import { AsrComparison } from './AsrComparison';

export function SpeechLab() {
  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState('');
  const [segment, setSegment] = useState<TranscriptSegment | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [evidence, setEvidence] = useState<ModalityEvidence[]>([]);
  const [emotion, setEmotion] = useState(false);
  const research = useLabResearch();
  const worker = useRef<Worker | null>(null);
  const emotionWorker = useRef<Worker | null>(null);
  const abort = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const cancel = () => {
    generation.current++;
    abort.current?.abort();
    worker.current?.terminate();
    emotionWorker.current?.terminate();
    worker.current = null;
    emotionWorker.current = null;
    setBusy(false);
  };
  useEffect(() => {
    const hide = () => {
      if (document.hidden) cancel();
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      cancel();
    };
  }, []);
  const run = async () => {
    if (!file) return;
    cancel();
    const current = generation.current;
    abort.current = new AbortController();
    setBusy(true);
    setSegment(null);
    setEvidence([]);
    setError('');
    let context: AudioContext | null = null;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Chọn audio không quá 10 MiB.');
      context = new AudioContext();
      const decoded = await context.decodeAudioData(await file.arrayBuffer());
      await context.close();
      context = null;
      if (decoded.duration > 30 || decoded.duration < 0.3)
        throw new Error('Đoạn kiểm thử cần dài từ 0,3 đến 30 giây.');
      const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
      const source = offline.createBufferSource();
      source.buffer = decoded;
      source.connect(offline.destination);
      source.start();
      const rendered = await offline.startRendering();
      if (current !== generation.current) return;
      const samples = rendered.getChannelData(0).slice();
      setSeconds(decoded.duration);
      const asr = new Worker(
        new URL('../../infrastructure/inference/speech.worker.ts', import.meta.url),
        { type: 'module' },
      );
      worker.current = asr;
      asr.addEventListener('message', (event) => {
        if (event.data?.type === 'ready')
          emitAudit('asr-model-ready', {
            modelProfile: event.data.modelVersion?.startsWith('gipformer')
              ? 'gipformer1.5-int8'
              : event.data.modelVersion?.startsWith('phowhisper')
                ? 'phowhisper-tiny-q8'
                : 'whisper-tiny-q8',
          });
      });
      await makeWorkerReady(asr, { type: 'init', profile: research.asr }, abort.current.signal);
      emitAudit('video-test-branch-ready', { branch: 'speech' });
      if (current !== generation.current) return;
      const result = await new Promise<TranscriptSegment>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('ASR chưa hoàn tất sau 120 giây.')),
          120_000,
        );
        abort.current?.signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            reject(new DOMException('Cancelled', 'AbortError'));
          },
          { once: true },
        );
        asr.onmessage = (e) => {
          if (e.data.type === 'result') {
            clearTimeout(timer);
            resolve(e.data.segment);
          }
          if (e.data.type === 'error') {
            clearTimeout(timer);
            reject(new Error(e.data.message));
          }
        };
        asr.onerror = () => {
          clearTimeout(timer);
          reject(new Error('Worker phụ đề bị lỗi.'));
        };
        const data = samples.slice();
        asr.postMessage(
          {
            type: 'transcribe',
            id: crypto.randomUUID(),
            samples: data,
            startMs: 0,
            endMs: decoded.duration * 1000,
          },
          [data.buffer],
        );
      });
      if (current !== generation.current) return;
      setSegment(result);
      if (emotion || research.tone) {
        const analysis = new Worker(
          new URL('../../infrastructure/inference/emotion.worker.ts', import.meta.url),
          { type: 'module' },
        );
        emotionWorker.current = analysis;
        analysis.addEventListener('message', (event) => {
          if (event.data?.type === 'branch-warning')
            emitAudit('worker-failed', {
              branch: event.data.branch === 'voice' ? 'voice' : 'text',
              reason: 'worker-failed',
            });
          if (event.data?.type === 'ready' && event.data.voiceAvailable)
            emitAudit('video-test-branch-ready', {
              branch: 'voice',
              modelProfile: 'tone-mlp-research',
            });
        });
        await makeWorkerReady(
          analysis,
          { type: 'init', text: emotion, research: true, prosody: research.tone },
          abort.current.signal,
        );
        if (current !== generation.current) return;
        const items = await new Promise<ModalityEvidence[]>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Phân tích sắc thái quá lâu.')), 120_000);
          abort.current?.signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              reject(new DOMException('Cancelled', 'AbortError'));
            },
            { once: true },
          );
          analysis.onmessage = (e) => {
            if (e.data.type === 'result') {
              clearTimeout(timer);
              resolve(e.data.evidence);
            }
            if (e.data.type === 'error') {
              clearTimeout(timer);
              reject(new Error(e.data.message));
            }
          };
          analysis.onerror = () => {
            clearTimeout(timer);
            reject(new Error('Worker sắc thái bị lỗi.'));
          };
          analysis.postMessage({
            type: 'infer',
            id: result.id,
            text: result.text,
            prosody: research.tone ? extractProsody(samples) : undefined,
            startMs: 0,
            endMs: decoded.duration * 1000,
            quality: estimateFileAudioQuality(samples),
          });
        });
        if (current === generation.current) setEvidence(items);
      }
    } catch (e) {
      emitAudit('video-test-failed', { branch: 'speech', reason: 'worker-failed' });
      if (current === generation.current)
        setError(e instanceof Error ? e.message : 'Không đọc được audio.');
    } finally {
      await context?.close().catch(() => {});
      if (current === generation.current) {
        worker.current?.terminate();
        emotionWorker.current?.terminate();
        setBusy(false);
      }
    }
  };
  const metrics = segment && reference.trim() ? speechError(reference, segment.text) : null;
  return (
    <>
      <PageTitle
        eyebrow="KIỂM THỬ LOCAL"
        title="Phòng kiểm thử tiếng nói"
        subtitle="Chọn audio có quyền sử dụng. File không upload; kết quả tạm trong bộ nhớ, không kích hoạt motor."
      />
      <section className="card settings-card">
        <label className="field">
          Chọn WAV/MP3/WebM
          <input
            type="file"
            accept="audio/*"
            disabled={busy || comparing}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setSegment(null);
              setEvidence([]);
            }}
          />
        </label>
        <label className="field">
          Văn bản tham chiếu
          <textarea
            disabled={busy || comparing}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            maxLength={10000}
          />
        </label>
        <ResearchOptions research={research} disabled={busy || comparing} onBusy={setComparing} />
        <AsrComparison
          file={file}
          reference={reference}
          disabled={busy || comparing}
          onBusy={setComparing}
        />
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={emotion}
            disabled={busy || comparing}
            onChange={(e) => setEmotion(e.target.checked)}
          />
          <span>Phân tích thêm sắc thái văn bản</span>
        </label>
        <div className="lab-actions">
          <button
            className="button primary"
            disabled={!file || busy || comparing || research.loading}
            onClick={() => void run()}
          >
            {busy ? 'Đang xử lý…' : 'Chạy kiểm thử tiếng Việt'}
          </button>
          {busy && (
            <button className="button secondary" onClick={cancel}>
              Hủy xử lý
            </button>
          )}
        </div>
        {segment && (
          <div className="speech-lab-result">
            <h2>Phụ đề nhận được</h2>
            <p className="lab-transcript">{segment.text}</p>
            <p>
              Thời gian suy luận: {segment.processingMs.toFixed(0)} ms · Audio: {seconds.toFixed(2)}{' '}
              giây · RTF: {(segment.processingMs / (seconds * 1000)).toFixed(2)}
            </p>
            {metrics && (
              <p>
                WER: {((metrics.wer ?? 0) * 100).toFixed(1)}% · CER:{' '}
                {((metrics.cer ?? 0) * 100).toFixed(1)}%
              </p>
            )}
            <button
              className="button secondary"
              onClick={() =>
                downloadJson('signemo-speech-evaluation.json', {
                  segment,
                  reference,
                  metrics,
                  seconds,
                  evidence,
                  browser: navigator.userAgent,
                  scope: 'local-file; no physical microphone or emotion validation',
                })
              }
            >
              Xuất kết quả JSON
            </button>
          </div>
        )}
        {evidence.map((item) => (
          <p key={item.source}>
            {item.source}: {JSON.stringify(item.scores)} · ngoài phạm vi{' '}
            {item.unsupportedScore.toFixed(3)}
          </p>
        ))}
        {error && (
          <p className="error-box" role="alert">
            {error}
          </p>
        )}
        <p className="fine-note">
          File dài kiểm thử ASR không đại diện độ trễ của từng cụm hội thoại. Không dùng tập test để
          chỉnh model.
        </p>
      </section>
    </>
  );
}
