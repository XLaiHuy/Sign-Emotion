import { useMemo, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { auditMessage, type AuditEvent } from '../../domain/audit';
import { PageTitle } from '../../shared/ui/PageTitle';
import {
  exportAuditEvents,
  removeAllAuditEvents,
  useAuditEvents,
} from '../../infrastructure/audit/log';

function timeLabel(timestamp: number) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(timestamp);
}

function detailLabel(event: AuditEvent) {
  const parts: string[] = [];
  const phase: Record<string, string> = {
    'preparing-assets': 'Chuẩn bị tài nguyên',
    'preparing-ai': 'Khởi động AI',
    'requesting-permission': 'Xin quyền thiết bị',
    connecting: 'Kết nối thiết bị',
    running: 'Đang hội thoại',
    ready: 'Sẵn sàng',
  };
  const branch: Record<string, string> = {
    assets: 'Tài nguyên',
    speech: 'Phụ đề',
    face: 'Camera',
    emotion: 'Gợi ý tổng hợp',
    storage: 'Lưu trên thiết bị',
    audio: 'Âm thanh',
  };
  const reason: Record<string, string> = {
    'permission-denied': 'Trình duyệt chưa cấp quyền',
    'device-missing': 'Không tìm thấy thiết bị',
    'device-busy': 'Thiết bị đang bận',
    'unsupported-browser': 'Trình duyệt chưa hỗ trợ',
    'worker-failed': 'AI chưa khởi động được',
    timeout: 'Hết thời gian chờ',
    storage: 'Bộ nhớ trình duyệt',
    offline: 'Mất kết nối mạng',
    'user-canceled': 'Bạn đã hủy',
    background: 'Ứng dụng chuyển nền',
    unknown: 'Chưa xác định nguyên nhân',
  };
  if (event.details.phase) parts.push(`Bước: ${phase[event.details.phase] ?? 'Đang xử lý'}`);
  if (event.details.branch) parts.push(`Thành phần: ${branch[event.details.branch] ?? 'Ứng dụng'}`);
  if (event.details.reason)
    parts.push(`Nguyên nhân: ${reason[event.details.reason] ?? 'Chưa xác định'}`);
  if (event.details.durationMs !== undefined)
    parts.push(`Thời gian: ${(event.details.durationMs / 1000).toFixed(1)} giây`);
  if (event.details.percent !== undefined) parts.push(`Tiến độ: ${event.details.percent}%`);
  return parts.join(' · ');
}

export function ActivityLogPage() {
  const events = useAuditEvents();
  const [filter, setFilter] = useState<'all' | 'issues' | 'session'>('all');
  const visible = useMemo(() => {
    if (filter === 'issues') return events.filter((event) => event.level !== 'info');
    if (filter === 'session') return events.filter((event) => event.sessionId);
    return events;
  }, [events, filter]);

  const download = async (format: 'json' | 'csv') => {
    const rows = await exportAuditEvents();
    const content =
      format === 'json'
        ? JSON.stringify(
            rows.map((event) => ({
              time: new Date(event.occurredAt).toISOString(),
              level: event.level,
              message: auditMessage(event),
              code: event.code,
              buildId: event.buildId,
              sessionId: event.sessionId,
              details: event.details,
            })),
            null,
            2,
          )
        : [
            'time,level,message,code,buildId,sessionId',
            ...rows.map((event) =>
              [
                new Date(event.occurredAt).toISOString(),
                event.level,
                auditMessage(event),
                event.code,
                event.buildId,
                event.sessionId ?? '',
              ]
                .map((value) => `"${String(value).replaceAll('"', '""')}"`)
                .join(','),
            ),
          ].join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'application/octet-stream' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `signemo-activity.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageTitle
        eyebrow="RIÊNG TƯ TRÊN THIẾT BỊ"
        title="Nhật ký hoạt động"
        subtitle="Giải thích các bước và lỗi gần đây bằng lời dễ hiểu. Nhật ký tự xóa sau 24 giờ."
      />
      <section className="card settings-card activity-log" aria-label="Nhật ký thao tác và lỗi">
        <header className="activity-toolbar">
          <label className="field">
            Hiển thị
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as typeof filter)}
            >
              <option value="all">Tất cả hoạt động</option>
              <option value="issues">Cảnh báo và lỗi</option>
              <option value="session">Phiên hội thoại</option>
            </select>
          </label>
          <div className="activity-actions">
            <button className="button secondary" onClick={() => void download('json')}>
              <Download size={16} /> Xuất JSON
            </button>
            <button className="button secondary" onClick={() => void download('csv')}>
              <Download size={16} /> Xuất CSV
            </button>
            <button className="button secondary" onClick={() => void removeAllAuditEvents()}>
              <Trash2 size={16} /> Xóa nhật ký
            </button>
          </div>
        </header>
        <p className="fine-note">
          Chỉ lưu mã thao tác, thời điểm và trạng thái kỹ thuật. Nhật ký không có hình ảnh, âm
          thanh, phụ đề hoặc nhận diện từng khung hình.
        </p>
        {visible.length ? (
          <ol className="activity-list">
            {visible.map((event) => (
              <li key={event.id} className={`activity-event level-${event.level}`}>
                <time dateTime={new Date(event.occurredAt).toISOString()}>
                  {timeLabel(event.occurredAt)}
                </time>
                <p>{auditMessage(event)}</p>
                {detailLabel(event) && <small>{detailLabel(event)}</small>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="activity-empty">Chưa có hoạt động phù hợp.</p>
        )}
      </section>
    </>
  );
}
