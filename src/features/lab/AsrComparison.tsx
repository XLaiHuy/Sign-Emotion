import { useEffect, useRef, useState } from 'react';
import comparisonUrl from '../../infrastructure/inference/asr-comparison.worker.ts?worker&url';
import { decodeLocalAudio } from '../../infrastructure/media/decodeLocalAudio';
import { emitAudit } from '../../infrastructure/audit/log';
import { downloadJson } from '../../infrastructure/backend/reports';
import type { speechError } from '../../domain/speechMetrics';

export type RegionalDialect = 'Bắc' | 'Trung' | 'Nam' | 'Không rõ';

export interface RegionalModelSummary {
  dialect: RegionalDialect;
  profile: string;
  gainNormalization: boolean;
  count: number;
  avgWer: number | null;
  avgCer: number | null;
  avgRtf: number;
}

export interface Row {
  profile: string;
  modelVersion?: string;
  status: 'ok' | 'unavailable';
  prepareMs?: number;
  processingMs?: number;
  seconds?: number;
  rtf?: number;
  metrics?: ReturnType<typeof speechError> | null;
  text?: string;
  dialect?: RegionalDialect;
  gainNormalization?: boolean;
}

export function aggregateMetricsByRegionAndModel(
  history: readonly Row[],
): RegionalModelSummary[] {
  const map = new Map<
    string,
    {
      dialect: RegionalDialect;
      profile: string;
      gainNormalization: boolean;
      count: number;
      werSum: number;
      werCount: number;
      cerSum: number;
      cerCount: number;
      rtfSum: number;
    }
  >();

  for (const row of history) {
    if (row.status !== 'ok') continue;
    const dialect = row.dialect ?? 'Không rõ';
    const profile = row.profile;
    const gainNormalization = row.gainNormalization ?? true;
    const key = `${dialect}|${profile}|${gainNormalization}`;

    let item = map.get(key);
    if (!item) {
      item = {
        dialect,
        profile,
        gainNormalization,
        count: 0,
        werSum: 0,
        werCount: 0,
        cerSum: 0,
        cerCount: 0,
        rtfSum: 0,
      };
      map.set(key, item);
    }
    item.count++;
    if (row.metrics?.wer != null) {
      item.werSum += row.metrics.wer;
      item.werCount++;
    }
    if (row.metrics?.cer != null) {
      item.cerSum += row.metrics.cer;
      item.cerCount++;
    }
    if (row.rtf != null) {
      item.rtfSum += row.rtf;
    }
  }

  return Array.from(map.values()).map((item) => ({
    dialect: item.dialect,
    profile: item.profile,
    gainNormalization: item.gainNormalization,
    count: item.count,
    avgWer: item.werCount > 0 ? item.werSum / item.werCount : null,
    avgCer: item.cerCount > 0 ? item.cerSum / item.cerCount : null,
    avgRtf: item.count > 0 ? item.rtfSum / item.count : 0,
  }));
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
  dialect: propDialect = 'Không rõ',
  gainNormalization: propGainNormalization = true,
}: {
  file: File | null;
  reference: string;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
  dialect?: RegionalDialect;
  gainNormalization?: boolean;
}) {
  const active = useRef<ComparisonTask | null>(null);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [history, setHistory] = useState<Row[]>([]);
  const [dialect, setDialect] = useState<RegionalDialect>(propDialect);
  const [gainNormalization, setGainNormalization] = useState(propGainNormalization);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setDialect(propDialect);
  }, [propDialect]);

  useEffect(() => {
    setGainNormalization(propGainNormalization);
  }, [propGainNormalization]);
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
        worker.postMessage(
          {
            type: 'compare',
            samples: pcm,
            reference,
            dialect,
            gainNormalization,
          },
          [pcm.buffer],
        );
      });
      if (active.current !== task) return;
      setRows(result);
      setHistory((prev) => [...prev, ...result]);
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
  const summaries = aggregateMetricsByRegionAndModel(history.length ? history : rows);
  return (
    <details className="lab-research-options">
      <summary>So sánh ASR trên cùng audio</summary>
      <p>
        Chạy PhoWhisper-tiny rồi Gipformer INT8, không nạp đồng thời. Đây là phép đo file, chưa gồm
        VAD hoặc chữ tạm. Không có tham chiếu thì chỉ báo tốc độ.
      </p>
      <div className="lab-controls-row">
        <label className="field">
          Khu vực giọng
          <select
            aria-label="Khu vực giọng so sánh"
            disabled={disabled || running}
            value={dialect}
            onChange={(e) => setDialect(e.target.value as RegionalDialect)}
          >
            <option value="Không rõ">Không rõ / Toàn quốc</option>
            <option value="Bắc">Giọng Bắc</option>
            <option value="Trung">Giọng Trung</option>
            <option value="Nam">Giọng Nam</option>
          </select>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            aria-label="Chuẩn hóa biên độ so sánh"
            checked={gainNormalization}
            disabled={disabled || running}
            onChange={(e) => setGainNormalization(e.target.checked)}
          />
          <span>Chuẩn hóa biên độ (Gain Normalization cho ASR)</span>
        </label>
      </div>
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
      {summaries.length > 0 && (
        <div
          className="dialect-aggregates"
          role="region"
          aria-label="Báo cáo WER/CER theo vùng miền"
        >
          <h4>Báo cáo WER/CER tổng hợp theo vùng miền và mô hình</h4>
          <p className="fine-note">
            Số liệu thống kê tổng hợp ({history.length || rows.length} lượt đo). Tuyệt đối không
            lưu trữ hay truyền tải âm thanh hoặc phụ đề.
          </p>
          <table className="summary-table">
            <thead>
              <tr>
                <th>Vùng miền</th>
                <th>Mô hình</th>
                <th>Chuẩn hóa</th>
                <th>Số mẫu</th>
                <th>WER trung bình</th>
                <th>CER trung bình</th>
                <th>RTF trung bình</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s, idx) => (
                <tr key={`${s.dialect}-${s.profile}-${s.gainNormalization}-${idx}`}>
                  <td>{s.dialect}</td>
                  <td>{s.profile === 'phowhisper' ? 'PhoWhisper-tiny q8' : 'Gipformer 1.5 INT8'}</td>
                  <td>{s.gainNormalization ? 'Bật' : 'Tắt'}</td>
                  <td>{s.count}</td>
                  <td>{s.avgWer != null ? `${(s.avgWer * 100).toFixed(1)}%` : '—'}</td>
                  <td>{s.avgCer != null ? `${(s.avgCer * 100).toFixed(1)}%` : '—'}</td>
                  <td>{s.avgRtf.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > 0 && (
        <button
          className="text-button"
          onClick={() =>
            downloadJson('signemo-asr-comparison.json', {
              schemaVersion: 1,
              createdAt: new Date().toISOString(),
              buildId: import.meta.env.VITE_BUILD_ID || 'development',
              rows: rows.map(({ text: _text, ...metrics }) => metrics),
              summaries,
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
