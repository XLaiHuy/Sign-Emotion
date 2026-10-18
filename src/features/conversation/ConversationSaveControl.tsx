import { useEffect, useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import type { useVault } from '../history/useVault';

export function ConversationSaveControl({
  store,
  enabled,
  running,
  skip,
  onChange,
  onSkip,
}: {
  store: ReturnType<typeof useVault>;
  enabled: boolean;
  running: boolean;
  skip: boolean;
  onChange: (value: boolean) => void;
  onSkip: () => void;
}) {
  const [exists, setExists] = useState(false),
    [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    void store.vault.exists().then((value) => {
      if (live) setExists(value);
    });
    return () => {
      live = false;
    };
  }, [store.vault, store.revision]);
  const needsUnlock = ((enabled && !skip) || store.persistence.unsaved) && !store.vault.unlocked;
  const state = store.saveState;
  const label =
    state === 'saving'
      ? 'Đang lưu…'
      : state === 'error'
        ? 'Lưu chưa xong'
        : needsUnlock
          ? 'Cần mở khóa để lưu'
          : store.persistence.unsaved
            ? 'Lưu chưa xong'
            : state === 'saved'
              ? 'Đã lưu trên thiết bị'
              : !enabled || skip
                ? 'Phiên này không lưu'
                : 'Sẽ tự lưu khi có lời nói';
  return (
    <section className="conversation-save" aria-label="Lưu hội thoại">
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={enabled}
          disabled={running}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>Lưu hội thoại trên thiết bị</span>
      </label>
      <p className={`save-status save-${state}`} role="status">
        <LockKeyhole size={16} />
        {label}
      </p>
      {needsUnlock && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              if (exists) await store.vault.unlock(password);
              else await store.vault.create(password);
              setPassword('');
              store.refresh();
            } catch {
              setError('Chưa mở được lịch sử. Kiểm tra mật khẩu rồi thử lại.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field">
            {exists ? 'Mật khẩu lịch sử' : 'Tạo mật khẩu lịch sử'}
            <input
              type="password"
              required
              minLength={exists ? 1 : 10}
              autoComplete={exists ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={exists ? 'Nhập mật khẩu' : 'Tối thiểu 10 ký tự'}
            />
          </label>
          <div className="save-actions">
            <button className="button secondary" disabled={busy}>
              {busy ? 'Đang mở…' : exists ? 'Mở khóa để lưu' : 'Tạo kho để lưu'}
            </button>
            {!running && !store.persistence.unsaved && (
              <button type="button" className="text-button" onClick={onSkip}>
                Tiếp tục không lưu phiên này
              </button>
            )}
          </div>
          <small>
            Lịch sử chỉ lưu trên trình duyệt này, tối đa 30 ngày. Kho tự khóa sau 5 phút không thao
            tác.
          </small>
        </form>
      )}
      {state === 'error' && (
        <button
          type="button"
          className="text-button"
          onClick={() => void store.persistence.retry()}
        >
          Thử lưu lại
        </button>
      )}
      {store.persistence.unsaved && !running && state !== 'saving' && (
        <button
          type="button"
          className="text-button"
          onClick={() => {
            if (window.confirm('Bỏ phần hội thoại chưa lưu? Các câu đã lưu vẫn được giữ.'))
              store.persistence.discard();
          }}
        >
          Bỏ phần chưa lưu
        </button>
      )}
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
