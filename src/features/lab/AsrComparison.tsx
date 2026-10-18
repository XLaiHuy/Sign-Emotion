import { useEffect, useRef, useState } from 'react';
import comparisonUrl from '../../infrastructure/inference/asr-comparison.worker.ts?worker&url';
import { decodeLocalAudio } from '../../infrastructure/media/decodeLocalAudio';
import { emitAudit } from '../../infrastructure/audit/log';
import { downloadJson } from '../../infrastructure/backend/reports';
import type { speechError } from '../../domain/speechMetrics';

interface Row {
  profile: string;
  modelVersion?: string;
  status: 'ok' | 'unavailable';
  prepareMs?: number;
  processingMs?: number;
  seconds?: number;
  rtf?: number;
  metrics?: ReturnType<typeof speechError> | null;
  text?: string;
}
interface ComparisonTask {
  worker?: Worker;
  abort: AbortController;
  timer?: ReturnType<typeof setTimeout>;
}
export function AsrComparison({
  file,
  reference,
  disabled,
  onBusy,
}: {
  file: File | null;
  reference: string;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const active = useRef<ComparisonTask | null>(null);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [notice, setNotice] = useState('');
  const cancel = () => {
    const task = active.current;
    active.current = null;
    task?.abort.abort();
    task?.worker?.terminate();
    clearTimeout(task?.timer);
    setRunning(false);
    onBusy(false);
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
  useEffect(() => {
    setRows([]);
    setNotice('');
  }, [file, reference]);
  const run = async () => {
    if (!file || disabled || active.current) return;
    const task: ComparisonTask = { abort: new AbortController() };
    active.current = task;
    setRunning(true);
    onBusy(true);
    setRows([]);
    setNotice('Đang đọc audio trên thiết bị…');
    emitAudit('model-comparison-started', { branch: 'speech', count: 2 });
    try {
      const pcm = await decodeLocalAudio(file, task.abort.signal);
      if (active.current !== task) return;
      const worker = new Worker(comparisonUrl, { type: 'module' });
      task.worker = worker;
      const result = await new Promise<Row[]>((resolve, reject) => {
        const stop = () => reject(new DOMException('Cancelled', 'AbortError'));
        task.abort.signal.addEventListener('abort', stop, { once: true });
        const done = (value?: Row[]) => {
          clearTimeout(task.timer);
          task.abort.signal.removeEventListener('abort', stop);
          if (value) resolve(value);
          else reject(new Error('Comparison failed'));
        };
        task.timer = setTimeout(() => done(), 300000);
        worker.onerror = () => done();
        worker.onmessage = ({ data }) => {
          if (active.current !== task) return;
          if (data.type === 'progress')
            setNotice(
              `Đang đo ${data.profile === 'phowhisper' ? 'PhoWhisper-tiny' : 'Gipformer 1.5 INT8'}…`,
            );
          if (data.type === 'result') done(data.rows);
          if (data.type === 'error') done();
        };
        worker.postMessage({ type: 'compare', samples: pcm, reference }, [pcm.buffer]);
      });
      if (active.current !== task) return;
      setRows(result);
      setNotice('Đã đo tuần tự trên cùng PCM. Chưa đổi model mặc định.');
      emitAudit('model-comparison-completed', {
        branch: 'speech',
        count: result.filter((r) => r.status === 'ok').length,
      });
    } catch {
      if (active.current === task) {
        setNotice('Chưa so sánh được. Kiểm tra audio và tài nguyên lab local rồi thử lại.');
        emitAudit('model-comparison-failed', { branch: 'speech', reason: 'worker-failed' });
      }
    } finally {
      if (active.current === task) cancel();
    }
  };
  return (
    <details className="lab-research-options">
      <summary>So sánh ASR trên cùng audio</summary>
      <p>
        Chạy PhoWhisper-tiny rồi Gipformer INT8, không nạp đồng thời. Đây là phép đo file, chưa gồm
        VAD hoặc chữ tạm. Không có tham chiếu thì chỉ báo tốc độ.
      </p>
      <button className="button secondary" disabled={!file || disabled} onClick={() => void run()}>
        So sánh PhoWhisper và Gipformer
      </button>
      {running && (
        <button
          className="button secondary"
          onClick={() => {
            cancel();
            setNotice('Đã hủy so sánh ASR.');
          }}
        >
          Hủy so sánh ASR
        </button>
      )}
      {notice && <p role="status">{notice}</p>}
      {rows.map((row) => (
        <div key={row.profile}>
          <strong>
            {row.profile === 'phowhisper' ? 'PhoWhisper-tiny q8' : 'Gipformer 1.5 INT8'}
          </strong>
          {row.status === 'unavailable' ? (
            <p>Nhánh này chưa chạy được; kiểm tra gói lab.</p>
          ) : (
            <>
              <p>
                Chuẩn bị {row.prepareMs?.toFixed(0)} ms · giải mã {row.processingMs?.toFixed(0)} ms
                · RTF {row.rtf?.toFixed(2)}
              </p>
              {row.metrics && (
                <p>
                  WER {((row.metrics.wer ?? 0) * 100).toFixed(1)}% · CER{' '}
                  {((row.metrics.cer ?? 0) * 100).toFixed(1)}%
                </p>
              )}
              <details>
                <summary>Phụ đề tạm trong phiên kiểm thử</summary>
                <p>{row.text}</p>
              </details>
            </>
          )}
        </div>
      ))}
      {rows.length > 0 && (
        <button
          className="text-button"
          onClick={() =>
            downloadJson('signemo-asr-comparison.json', {
              schemaVersion: 1,
              createdAt: new Date().toISOString(),
              buildId: import.meta.env.VITE_BUILD_ID || 'development',
              rows: rows.map(({ text: _text, ...metrics }) => metrics),
              scope: 'local-file, same PCM; no media or transcript exported',
            })
          }
        >
          Xuất số đo ASR, không kèm phụ đề
        </button>
      )}
    </details>
  );
}
