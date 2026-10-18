import { useEffect, useState } from 'react';
import { LockKeyhole, Trash2, Download } from 'lucide-react';
import type { ConversationRecord } from '../../domain/conversation';
import type { useVault } from './useVault';
import { PageTitle } from '../../shared/ui/PageTitle';
import { downloadJson } from '../../infrastructure/backend/reports';
import { emitAudit } from '../../infrastructure/audit/log';
export function HistoryPage({ store }: { store: ReturnType<typeof useVault> }) {
  const [exists, setExists] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [records, setRecords] = useState<ConversationRecord[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);
  const reload = () => {
    void store.vault.exists().then(setExists);
    if (store.vault.unlocked)
      void store.vault
        .list()
        .then(setRecords)
        .catch(() => setError('Không đọc được lịch sử. Bản ghi có thể đã hỏng.'));
    else setRecords([]);
  };
  useEffect(() => {
    let cancelled = false;
    void store.vault.exists().then((value) => {
      if (!cancelled) setExists(value);
    });
    if (!store.vault.unlocked) setRecords([]);
    else
      void store.vault
        .list()
        .then((value) => {
          if (!cancelled) setRecords(value);
        })
        .catch(() => {
          if (!cancelled) setError('Không đọc được lịch sử.');
        });
    return () => {
      cancelled = true;
    };
  }, [store.vault, store.revision, store.saveState]);
  const unlock = async () => {
    setBusy(true);
    setError('');
    try {
      if (exists) await store.vault.unlock(password);
      else await store.vault.create(password);
      emitAudit('vault-opened', { branch: 'storage' });
      setPassword('');
      store.refresh();
    } catch (e) {
      emitAudit('vault-unlock-failed', { branch: 'storage', reason: 'unknown' });
      setError(e instanceof Error ? e.message : 'Không mở được kho.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageTitle
        eyebrow="CHỈ TRÊN THIẾT BỊ NÀY"
        title="Những cuộc trò chuyện"
        subtitle="Lịch sử văn bản được mã hóa bằng mật khẩu và giữ tối đa 30 ngày. Không lưu giọng nói hoặc hình ảnh."
      />
      {!store.vault.unlocked ? (
        <form
          className="card settings-card narrow vault-login-card"
          onSubmit={(e) => {
            e.preventDefault();
            void unlock();
          }}
        >
          <div className="vault-lock-icon-wrapper">
            <LockKeyhole aria-hidden="true" size={28} />
          </div>
          <h2>{exists ? 'Mở khóa lịch sử' : 'Tạo kho lịch sử'}</h2>
          <p className="vault-subtitle">
            Dữ liệu phụ đề được bảo vệ bằng mật khẩu cục bộ, chỉ lưu trên máy của bạn.
          </p>
          <label className="field">
            Mật khẩu
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={exists ? 1 : 10}
              required
              placeholder={exists ? 'Nhập mật khẩu kho…' : 'Tạo mật khẩu (tối thiểu 10 ký tự)…'}
              autoComplete={exists ? 'current-password' : 'new-password'}
            />
          </label>
          <p className="fine-note">
            Không có khôi phục mật khẩu. Bạn vẫn có thể hội thoại tự do mà không cần lưu.
          </p>
          <button className="button primary vault-submit-btn" disabled={busy}>
            {busy ? 'Đang mở…' : exists ? 'Mở khóa' : 'Tạo kho'}
          </button>
        </form>
      ) : (
        <>
          <div className="lab-actions">
            <button className="button secondary" onClick={store.lock}>
              <LockKeyhole size={18} />
              Khóa lịch sử
            </button>
            <p>Kho đang mở: có thể chọn lưu khi bắt đầu hội thoại.</p>
          </div>
          {!records.length && <p className="empty-state">Chưa có cuộc trò chuyện được lưu.</p>}
          {store.persistence.unsaved && (
            <p role="status">
              Còn câu chưa lưu.{' '}
              <button className="text-button" onClick={() => void store.persistence.retry()}>
                Lưu lại
              </button>
            </p>
          )}
          {records.map((record) => (
            <article className="card history-record" key={record.id}>
              <h2>{new Date(record.createdAt).toLocaleString('vi-VN')}</h2>
              <div className="transcript-history">
                {record.segments.map((segment) => (
                  <p key={segment.id}>{segment.text}</p>
                ))}
              </div>
              <div className="lab-actions">
                <button
                  className="button secondary"
                  onClick={() => {
                    downloadJson(`signemo-${record.createdAt.slice(0, 10)}.json`, record);
                    emitAudit('vault-exported', { branch: 'storage' });
                  }}
                >
                  <Download size={16} />
                  Tải bản sao hội thoại
                </button>
                <button
                  className="text-button danger"
                  onClick={() => {
                    void store.vault
                      .remove(record.id)
                      .then(() => {
                        emitAudit('vault-record-deleted', { branch: 'storage' });
                        reload();
                      })
                      .catch(() => {
                        emitAudit('vault-operation-failed', {
                          branch: 'storage',
                          reason: 'storage',
                        });
                        setError('Chưa xóa được phiên khỏi kho.');
                      });
                  }}
                >
                  <Trash2 size={16} />
                  Xóa phiên
                </button>
              </div>
            </article>
          ))}
        </>
      )}
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      {exists && (
        <section className="vault-reset">
          <button className="text-button danger" onClick={() => setConfirmReset(true)}>
            Xóa toàn bộ kho / quên mật khẩu
          </button>
          {confirmReset && (
            <div className="error-box">
              <p>Xóa toàn bộ lịch sử mã hóa trên thiết bị này? Không thể khôi phục.</p>
              <div className="lab-actions">
                <button className="button secondary" onClick={() => setConfirmReset(false)}>
                  Giữ lại
                </button>
                <button
                  className="button danger"
                  onClick={() => {
                    store.persistence.clear();
                    void store.vault.reset().then(() => {
                      emitAudit('vault-cleared', { branch: 'storage' });
                      setRecords([]);
                      setExists(false);
                      setConfirmReset(false);
                      store.refresh();
                    });
                  }}
                >
                  Xóa toàn bộ
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}
