import { useEffect, useState, type FormEvent } from 'react';
import {
  CONSENT_VERSION,
  MODEL_VERSION,
  reportSchema,
  type SessionMetrics,
} from '../../shared/contracts';
import {
  allowReportUpload,
  backendConfigured,
  backendDestination,
  deleteLocalReport,
  downloadJson,
  syncReports,
  withdrawByCode,
  withdrawReport,
} from '../../infrastructure/backend/reports';
import { createDeletionToken, db, type QueuedReport } from '../../infrastructure/storage/database';
import { emitAudit } from '../../infrastructure/audit/log';

export function Feedback({
  metrics,
  onNotice,
  modelVersion = MODEL_VERSION,
}: {
  metrics: SessionMetrics | null;
  onNotice: (v: string) => void;
  modelVersion?: string;
}) {
  const [usefulness, setUsefulness] = useState(3),
    [distraction, setDistraction] = useState(1),
    [comment, setComment] = useState('');
  const [delivery, setDelivery] = useState<'local-only' | 'pilot-upload'>('local-only'),
    [agreed, setAgreed] = useState(false),
    [busy, setBusy] = useState(false);
  const [reports, setReports] = useState<QueuedReport[]>([]),
    [permissions, setPermissions] = useState<string[]>([]);
  const refresh = async () => {
    const rows = await db.reports.toArray();
    setReports(rows.reverse());
  };
  useEffect(() => {
    void refresh().catch(() => onNotice('Không mở được dữ liệu trên thiết bị.'));
  }, []);
  const action = async (task: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await task();
      await refresh();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Không xử lý được phản hồi');
    } finally {
      setBusy(false);
    }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!metrics || !agreed || busy || (delivery === 'pilot-upload' && !backendConfigured)) return;
    await action(async () => {
      const report = reportSchema.parse({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        consentVersion: CONSENT_VERSION,
        modelVersion,
        feedback: { usefulness, distraction, comment },
        metrics,
      });
      await db.reports.put({
        id: report.id,
        report,
        createdAt: report.createdAt,
        deletionToken: createDeletionToken(),
        state: delivery === 'pilot-upload' ? 'queued' : 'local',
        deliveryConsent: delivery,
        ...(delivery === 'pilot-upload'
          ? { destination: backendDestination, consentedAt: new Date().toISOString() }
          : {}),
      });
      emitAudit('report-saved');
      await syncReports();
      setAgreed(false);
      setComment('');
      onNotice(
        delivery === 'local-only'
          ? 'Đã lưu trên thiết bị; không tự gửi khi có server.'
          : 'Đã lưu yêu cầu gửi. Xem trạng thái bên dưới.',
      );
    });
  };
  const states = {
    local: 'Chỉ lưu trên thiết bị',
    queued: 'Chờ gửi đến đích đã đồng ý',
    sent: 'Đã gửi',
    withdrawing: 'Chờ rút lại trên server — đã xóa nội dung local',
    withdrawn: 'Đã rút lại',
  };
  return (
    <>
      <div className="standard-heading">
        <div className="eyebrow">CÙNG LÀM SIGNEMO TỐT HƠN</div>
        <h1>Trải nghiệm của bạn rất quan trọng</h1>
        <p>
          Phản hồi tùy chọn sau một phiên camera. Không dùng đánh giá này làm nhãn huấn luyện AI.
        </p>
      </div>
      <div className="feedback-grid">
        <form className="card settings-card" onSubmit={(e) => void submit(e)}>
          <h2>Phản hồi phiên vừa rồi</h2>
          {!metrics && (
            <div className="banner">Hãy hoàn thành một phiên camera trước khi lưu phản hồi.</div>
          )}
          <label className="range-label">
            Gợi ý có hữu ích không? <strong>{usefulness}/5</strong>
            <input
              aria-label="Mức hữu ích"
              type="range"
              min="1"
              max="5"
              value={usefulness}
              onChange={(e) => setUsefulness(Number(e.target.value))}
            />
            <small>1: Không hữu ích · 5: Rất hữu ích</small>
          </label>
          <label className="range-label">
            Nhịp có gây phân tâm không? <strong>{distraction}/5</strong>
            <input
              aria-label="Mức phân tâm"
              type="range"
              min="1"
              max="5"
              value={distraction}
              onChange={(e) => setDistraction(Number(e.target.value))}
            />
            <small>1: Không phân tâm · 5: Rất phân tâm</small>
          </label>
          <label className="field">
            Điều bạn muốn chia sẻ
            <textarea
              maxLength={1000}
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Không ghi tên hoặc thông tin cá nhân…"
            />
            <small>{comment.length}/1000 ký tự</small>
          </label>
          <label className="field">
            Nơi lưu phản hồi
            <select
              value={delivery}
              onChange={(e) => {
                setDelivery(e.target.value as typeof delivery);
                setAgreed(false);
              }}
            >
              <option value="local-only">Lưu trên thiết bị</option>
              <option disabled={!backendConfigured} value="pilot-upload">
                Gửi cho dự án qua Supabase
              </option>
            </select>
          </label>
          <p className="destination">
            {delivery === 'local-only'
              ? 'Nơi lưu: IndexedDB của trình duyệt trên máy này. Xóa dữ liệu trình duyệt sẽ mất bản lưu.'
              : `Nơi nhận: ${backendDestination} → database pilot → chủ dự án xem trong quản trị.`}
          </p>
          {!backendConfigured && (
            <p className="fine-note">
              Chưa cấu hình Supabase. Hiện không có nơi nhận feedback trên server.
            </p>
          )}
          <p className="fine-note">
            Dữ liệu gồm rating, nhận xét, phiên bản model và thống kê tổng hợp. Không kèm ảnh,
            video, landmarks hoặc lịch sử từng frame.
          </p>
          <label className="checkbox-label">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              {delivery === 'local-only'
                ? 'Tôi đồng ý lưu phản hồi trên thiết bị này.'
                : 'Tôi đồng ý gửi phản hồi đến project được ghi ở trên, có thể rút lại bằng mã xóa.'}
            </span>
          </label>
          <button className="button primary" disabled={!metrics || !agreed || busy}>
            {delivery === 'local-only' ? 'Lưu trên thiết bị' : 'Lưu và gửi cho dự án'}
          </button>
        </form>
        <section className="card settings-card">
          <h2>Phản hồi trên thiết bị</h2>
          <p>Lưu mã xóa của bản đã gửi để có thể rút lại sau khi xóa dữ liệu trình duyệt.</p>
          <button className="text-button" disabled={busy} onClick={() => void action(syncReports)}>
            Thử gửi lại / cập nhật
          </button>
          {!reports.length && <p>Chưa có phản hồi nào.</p>}
          {reports.map((item) => (
            <article className="report-item" key={item.id}>
              <strong>
                {item.createdAt || item.report?.createdAt
                  ? new Date(item.createdAt ?? item.report!.createdAt).toLocaleString('vi-VN')
                  : 'Báo cáo đã xóa nội dung'}
              </strong>
              <span className="pill">{states[item.state]}</span>
              {item.destination && (
                <small className="destination">Đích đã đồng ý: {item.destination}</small>
              )}
              {item.error && <p className="error-text">{item.error}</p>}
              <div className="report-actions">
                {item.state !== 'local' && (
                  <button
                    className="text-button"
                    onClick={() =>
                      downloadJson('signemo-ma-xoa.json', {
                        reportId: item.id,
                        deletionToken: item.deletionToken,
                        destination: item.destination,
                      })
                    }
                  >
                    Lưu mã xóa
                  </button>
                )}
                {['queued', 'sent', 'withdrawing'].includes(item.state) && (
                  <button
                    className="text-button danger"
                    disabled={busy}
                    onClick={() => void action(() => withdrawReport(item))}
                  >
                    Rút lại phản hồi
                  </button>
                )}
                {['local', 'sent', 'withdrawn'].includes(item.state) && (
                  <button
                    className="text-button danger"
                    disabled={busy}
                    onClick={() => void action(() => deleteLocalReport(item.id))}
                  >
                    {item.state === 'sent'
                      ? 'Xóa bản trên máy (server vẫn giữ)'
                      : 'Xóa trên thiết bị'}
                  </button>
                )}
              </div>
              {item.state === 'local' && backendConfigured && (
                <details>
                  <summary>Cho phép gửi bản local cho dự án</summary>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={permissions.includes(item.id)}
                      onChange={(e) =>
                        setPermissions((v) =>
                          e.target.checked ? [...v, item.id] : v.filter((id) => id !== item.id),
                        )
                      }
                    />
                    Tôi đồng ý gửi feedback và thống kê đến {backendDestination}.
                  </label>
                  <button
                    className="button secondary"
                    disabled={busy || !permissions.includes(item.id)}
                    onClick={() => void action(() => allowReportUpload(item))}
                  >
                    Gửi với đồng ý mới
                  </button>
                </details>
              )}
            </article>
          ))}
          <WithdrawalForm onNotice={onNotice} onDone={refresh} />
        </section>
      </div>
    </>
  );
}
function WithdrawalForm({
  onNotice,
  onDone,
}: {
  onNotice: (v: string) => void;
  onDone: () => Promise<unknown>;
}) {
  const [id, setId] = useState(''),
    [token, setToken] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <details className="diagnostics">
      <summary>Rút lại bằng mã đã lưu</summary>
      <p>
        Yêu cầu sẽ đến {backendDestination || 'project Supabase chưa được cấu hình'}. Kiểm tra đúng
        đích trên mã đã lưu.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!/^[a-f0-9]{64}$/.test(token) || !id) {
            onNotice('Kiểm tra mã báo cáo và mã xóa.');
            return;
          }
          setBusy(true);
          void withdrawByCode(id, token)
            .then(onDone)
            .then(() => {
              setToken('');
              setId('');
              onNotice(
                navigator.onLine
                  ? 'Đã xử lý yêu cầu rút lại.'
                  : 'Đã lưu yêu cầu, sẽ thử lại khi có mạng.',
              );
            })
            .catch((e) => onNotice(e instanceof Error ? e.message : 'Chưa rút lại được'))
            .finally(() => setBusy(false));
        }}
      >
        <label className="field">
          Mã báo cáo
          <input required value={id} onChange={(e) => setId(e.target.value)} />
        </label>
        <label className="field">
          Mã xóa
          <input
            type="password"
            required
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </label>
        <button className="button secondary" disabled={busy || !backendConfigured}>
          Rút lại
        </button>
      </form>
    </details>
  );
}
