import {
  Activity,
  Activity as ActivityLogButtonIcon,
  Camera,
  Download,
  LockKeyhole,
  LoaderCircle,
  Smartphone,
  WifiOff,
} from 'lucide-react';
import { backendConfigured } from '../../infrastructure/backend/reports';
import { defaultSettings, type Settings } from '../../shared/contracts';
import { PageTitle } from '../../shared/ui/PageTitle';
import {
  retryModelPreparation,
  usePreparationStatus,
} from '../../infrastructure/offline/preparationStatus';

interface SettingsPageProps {
  settings: Settings;
  changeSettings: (next: Settings) => void;
  prepare: () => Promise<void>;
  preparing: boolean;
  progress: number;
  offline: boolean;
  go: (page: 'lab' | 'speech-lab' | 'feedback' | 'admin' | 'activity') => void;
}

export function SettingsPage({
  settings,
  changeSettings,
  prepare,
  preparing,
  progress,
  offline,
  go,
}: SettingsPageProps) {
  const preparation = usePreparationStatus();
  const isPreparing = preparation.preparing || preparing;
  const currentProgress = preparation.preparing ? preparation.progress : progress;
  const isOfflineReady = preparation.offline || offline;
  return (
    <>
      <PageTitle
        eyebrow="THEO CÁCH CỦA BẠN"
        title="Cài đặt trải nghiệm"
        subtitle="Ưu tiên gợi ý ổn định, hạn chế rung khi biểu cảm chưa rõ."
      />
      <div className="settings-grid">
        <section className="card settings-card">
          <h2>Độ nhạy và nhịp phản hồi</h2>
          <p className="fine-note">
            Nhịp phản hồi theo nét mặt đã ổn định. Sắc thái câu nói và tổng hợp hiển thị riêng,
            không phát thêm nhịp.
          </p>
          <label className="field">
            Chế độ nhịp phản hồi
            <select
              value={settings.hapticMode ?? (settings.haptics ? 'auto' : 'off')}
              onChange={(e) =>
                changeSettings({
                  ...settings,
                  hapticMode: e.target.value as Settings['hapticMode'],
                  haptics: e.target.value !== 'off',
                })
              }
            >
              <option value="auto">Tự động — rung hoặc âm báo</option>
              <option value="visual">Chỉ mô phỏng hình ảnh</option>
              <option value="off">Tắt nhịp</option>
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.soundFeedback}
              onChange={(event) =>
                changeSettings({ ...settings, soundFeedback: event.target.checked })
              }
            />
            <span>Phát âm báo nhẹ khi thiết bị không hỗ trợ rung</span>
          </label>
          <label className="range-label">
            Độ chọn lọc gợi ý biểu cảm <strong>{Math.round(settings.threshold * 100)}%</strong>
            <input
              type="range"
              min="0.5"
              max="0.95"
              step="0.05"
              value={settings.threshold}
              onChange={(e) => changeSettings({ ...settings, threshold: Number(e.target.value) })}
            />
            <small>Mức cao giúp tránh rung nhầm; mức thấp sẽ nhạy bén hơn.</small>
          </label>
          <label className="range-label">
            Thời gian giữ nét mặt <strong>{settings.dwellMs} ms</strong>
            <input
              type="range"
              min="100"
              max="1500"
              step="100"
              value={settings.dwellMs}
              onChange={(e) => changeSettings({ ...settings, dwellMs: Number(e.target.value) })}
            />
            <small>Thời gian nét mặt duy trì ổn định trước khi xác nhận nhịp rung.</small>
          </label>
          <label className="range-label">
            Khoảng nghỉ giữa các nhịp <strong>{settings.cooldownMs / 1000} giây</strong>
            <input
              type="range"
              min="3000"
              max="10000"
              step="1000"
              value={settings.cooldownMs}
              onChange={(e) => changeSettings({ ...settings, cooldownMs: Number(e.target.value) })}
            />
            <small>Khoảng cách an toàn tránh báo rung quá dày làm gián đoạn cuộc trò chuyện.</small>
          </label>
          <button className="button secondary" onClick={() => changeSettings(defaultSettings)}>
            Khôi phục mặc định
          </button>
        </section>
        <section className="card settings-card">
          <h2>Dữ liệu và ngoại tuyến</h2>
          <p>
            Hình ảnh và giọng nói chỉ xử lý tạm trong bộ nhớ. Lịch sử văn bản chỉ lưu mã hóa khi
            được chọn. Phản hồi được quản lý riêng.
          </p>
          <p className="offline-package-status" role="status">
            {isPreparing ? (
              <>
                <LoaderCircle className="spin" size={17} /> Đang chuẩn bị tài nguyên ·{' '}
                {currentProgress}%
              </>
            ) : isOfflineReady ? (
              'Ứng dụng và tất cả model đã sẵn sàng khi mất mạng.'
            ) : (
              'Ứng dụng tự chuẩn bị model khi có mạng. Lần đầu cần tải tài nguyên về thiết bị.'
            )}
          </p>
          {isPreparing && (
            <progress max="100" value={currentProgress} aria-label="Tiến độ chuẩn bị model" />
          )}
          {isPreparing && preparation.detail && (
            <small className="fine-note">{preparation.detail}</small>
          )}
          {preparation.error && (
            <div className="error-box" role="alert">
              {preparation.error}
              <button
                className="text-button"
                onClick={() => {
                  retryModelPreparation();
                  void prepare();
                }}
                disabled={isPreparing}
              >
                <Download size={16} /> Thử lại
              </button>
            </div>
          )}
          <div className="divider" />
          <h3>Khả năng thiết bị</h3>
          <p>
            <Camera size={16} /> Camera:{' '}
            {window.isSecureContext && navigator.mediaDevices
              ? 'Có API hỗ trợ'
              : 'Cần HTTPS/trình duyệt phù hợp'}
          </p>
          <p>
            <Smartphone size={16} /> Rung:{' '}
            {'vibrate' in navigator
              ? 'Có API — motor chưa được kiểm chứng'
              : 'Dùng âm báo và mô phỏng'}
          </p>
          <p>
            <WifiOff size={16} /> Ngoại tuyến: {offline ? 'Đã lưu tài nguyên' : 'Chưa chuẩn bị'}
          </p>
          <p>
            <Activity size={16} /> Phản hồi:{' '}
            {backendConfigured ? 'Đã cấu hình máy chủ' : 'Đang lưu cục bộ'}
          </p>
          <button className="button secondary" onClick={() => go('lab')}>
            Mở phòng kiểm thử video
          </button>
          <button className="text-button" onClick={() => go('admin')}>
            <LockKeyhole size={16} />
            Quản trị pilot
          </button>
          <button className="button secondary" onClick={() => go('activity')}>
            <ActivityLogButtonIcon size={16} /> Nhật ký hoạt động
          </button>
        </section>
      </div>
      <div className="lab-actions">
        <button className="button secondary" onClick={() => go('speech-lab')}>
          Mở phòng kiểm thử tiếng nói
        </button>
        <button className="text-button" onClick={() => go('feedback')}>
          Phản hồi của bạn
        </button>
      </div>
    </>
  );
}
