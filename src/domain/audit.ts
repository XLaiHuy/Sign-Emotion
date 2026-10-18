export type AuditLevel = 'info' | 'warning' | 'error';
export type AuditPhase =
  | 'preparing-assets'
  | 'preparing-ai'
  | 'requesting-permission'
  | 'connecting'
  | 'running'
  | 'ready';

export function isInterruptedAuditPhase(phase?: AuditPhase, hasSession = false) {
  return (
    hasSession || phase === 'requesting-permission' || phase === 'connecting' || phase === 'running'
  );
}

export type AuditReason =
  | 'permission-denied'
  | 'device-missing'
  | 'device-busy'
  | 'unsupported-browser'
  | 'worker-failed'
  | 'timeout'
  | 'storage'
  | 'offline'
  | 'user-canceled'
  | 'background'
  | 'unknown';
export type AuditPage =
  | 'conversation'
  | 'history'
  | 'home'
  | 'practice'
  | 'feedback'
  | 'settings'
  | 'activity'
  | 'admin'
  | 'lab'
  | 'speech-lab';

export type AuditCode =
  | 'app-opened'
  | 'page-opened'
  | 'startup-interrupted'
  | 'assets-preparing'
  | 'core-assets-ready'
  | 'offline-ready'
  | 'preparation-failed'
  | 'ai-preparing'
  | 'ai-ready'
  | 'ai-preparation-failed'
  | 'asr-model-ready'
  | 'asr-performance'
  | 'preparation-progress'
  | 'permission-requested'
  | 'devices-opened'
  | 'permission-failed'
  | 'conversation-started'
  | 'conversation-canceled'
  | 'conversation-ended'
  | 'background-stopped'
  | 'pagehide-stopped'
  | 'camera-changed'
  | 'camera-change-failed'
  | 'fusion-enabled'
  | 'sound-changed'
  | 'caption-colors-changed'
  | 'avatar-changed'
  | 'avatar-unavailable'
  | 'haptic-test'
  | 'tone-preparing'
  | 'tone-ready'
  | 'tone-disabled'
  | 'tone-performance'
  | 'model-comparison-started'
  | 'model-comparison-completed'
  | 'model-comparison-failed'
  | 'tone-cache-unavailable'
  | 'tone-probe-started'
  | 'tone-probe-completed'
  | 'tone-probe-failed'
  | 'report-saved'
  | 'report-sent'
  | 'report-deleted'
  | 'report-withdraw-requested'
  | 'report-withdrawn'
  | 'report-send-failed'
  | 'report-withdraw-failed'
  | 'vault-opened'
  | 'vault-locked'
  | 'vault-unlock-failed'
  | 'vault-record-deleted'
  | 'vault-cleared'
  | 'vault-exported'
  | 'vault-operation-failed'
  | 'vault-save-succeeded'
  | 'vault-save-failed'
  | 'worker-failed'
  | 'performance-pressure'
  | 'video-test-file-selected'
  | 'video-test-reference-opened'
  | 'video-test-branch-ready'
  | 'video-test-started'
  | 'video-test-resumed'
  | 'video-test-paused'
  | 'video-test-seeked'
  | 'video-test-finished'
  | 'video-test-failed'
  | 'update-available'
  | 'app-error'
  | 'log-storage-unavailable';

export type AuditDetails = Readonly<{
  page?: AuditPage;
  phase?: AuditPhase;
  reason?: AuditReason;
  branch?: 'assets' | 'speech' | 'face' | 'emotion' | 'storage' | 'audio' | 'voice' | 'text';
  percent?: number;
  durationMs?: number;
  rtf?: number;
  count?: number;
  enabled?: boolean;
  modelProfile?:
    | 'phowhisper-tiny-q8'
    | 'whisper-tiny-q8'
    | 'gipformer1.5-int8'
    | 'emotieff-b0'
    | 'emotieff-b2-research'
    | 'tone-mlp-research'
    | 'emotion2vec-base-int8-research'
    | 'emotion2vec-base-fp32-gpu-research'
    | 'moonshine-streaming-tiny-vi-research';
}>;

export interface AuditEvent {
  id: string;
  occurredAt: number;
  level: AuditLevel;
  code: AuditCode;
  bootId: string;
  sessionId?: string;
  buildId: string;
  details: AuditDetails;
}

const copy: Record<AuditCode, string> = {
  'app-opened': 'Ứng dụng đã mở.',
  'page-opened': 'Bạn đã mở một mục trong ứng dụng.',
  'startup-interrupted': 'Phiên trước bị gián đoạn; chưa xác định nguyên nhân.',
  'assets-preparing': 'Đang chuẩn bị tài nguyên trên thiết bị.',
  'core-assets-ready': 'Đã chuẩn bị xong tài nguyên cốt lõi.',
  'offline-ready': 'Ứng dụng và model đã sẵn sàng khi mất mạng.',
  'preparation-failed': 'Chưa chuẩn bị được một số tài nguyên.',
  'ai-preparing': 'Đang khởi động AI trên thiết bị.',
  'ai-ready': 'Phụ đề và nhận diện khuôn mặt đã sẵn sàng.',
  'ai-preparation-failed': 'Chưa khởi động được AI cốt lõi.',
  'asr-model-ready': 'Model phụ đề đã sẵn sàng trên thiết bị.',
  'asr-performance': 'Đã ghi nhận tốc độ xử lý phụ đề tổng hợp; nội dung lời nói không được lưu.',
  'preparation-progress': 'Đang chuẩn bị tài nguyên.',
  'permission-requested': 'Đang xin quyền camera và micro.',
  'devices-opened': 'Camera và micro đã mở.',
  'permission-failed': 'Chưa mở được camera hoặc micro. Kiểm tra quyền và thiết bị rồi thử lại.',
  'conversation-started': 'Hội thoại đã bắt đầu.',
  'conversation-canceled': 'Bạn đã hủy thao tác bắt đầu hội thoại.',
  'conversation-ended': 'Hội thoại đã kết thúc; camera và micro đã tắt.',
  'background-stopped': 'Phiên đã dừng khi ứng dụng chuyển nền; camera và micro đã tắt.',
  'pagehide-stopped': 'Trang đã rời đi khi hội thoại đang chạy; camera và micro đã tắt.',
  'camera-changed': 'Đã đổi camera.',
  'camera-change-failed': 'Chưa đổi được camera. Hãy kiểm tra thiết bị rồi thử lại.',
  'fusion-enabled': 'Bạn đã bật thử gợi ý tổng hợp.',
  'sound-changed': 'Bạn đã thay đổi âm báo.',
  'caption-colors-changed': 'Bạn đã thay đổi hiển thị màu gợi ý cho phụ đề.',
  'avatar-changed': 'Bạn đã thay đổi minh họa avatar tùy chọn.',
  'tone-preparing': 'Đang chuẩn bị tone thử nghiệm trước hội thoại; chưa mở micro.',
  'tone-ready': 'Tone thử nghiệm đã sẵn sàng để bổ sung tổng hợp trong hội thoại.',
  'tone-disabled': 'Bạn đã tắt tone thử nghiệm.',
  'tone-performance': 'Đã ghi nhận thời gian xử lý tone; không lưu nội dung hoặc nhãn từng đoạn.',
  'model-comparison-started': 'Bạn đã bắt đầu so sánh model tuần tự trên cùng dữ liệu cục bộ.',
  'model-comparison-completed': 'Đã hoàn tất lượt so sánh model; chưa thay model mặc định.',
  'model-comparison-failed': 'Chưa hoàn tất so sánh model. Kiểm tra tài nguyên lab rồi thử lại.',
  'tone-cache-unavailable':
    'Chưa lưu được model tone vào cache. Phiên dùng bản đã xác minh trong bộ nhớ; lần sau có thể phải tải lại.',
  'tone-probe-started': 'Bạn đã bắt đầu kiểm tra model giọng nói thử nghiệm trên thiết bị.',
  'tone-probe-completed': 'Đã kiểm tra model giọng nói thử nghiệm; chưa bật trong hội thoại.',
  'tone-probe-failed': 'Chưa kiểm tra được model giọng nói thử nghiệm. Phụ đề không bị ảnh hưởng.',
  'avatar-unavailable': 'Minh họa 3D chưa sẵn sàng; phụ đề và hội thoại vẫn hoạt động.',
  'haptic-test': 'Bạn đã thử nhịp phản hồi.',
  'report-saved': 'Phản hồi đã được lưu trên thiết bị.',
  'report-sent': 'Phản hồi đã được gửi theo lựa chọn của bạn.',
  'report-deleted': 'Phản hồi đã được xóa khỏi thiết bị.',
  'report-withdraw-requested': 'Đã lưu yêu cầu rút phản hồi; sẽ gửi khi có mạng.',
  'report-withdrawn': 'Đã ghi nhận yêu cầu rút phản hồi.',
  'report-send-failed':
    'Chưa gửi được phản hồi. Phản hồi vẫn ở trên thiết bị; hãy kiểm tra kết nối rồi thử lại.',
  'report-withdraw-failed': 'Chưa rút được phản hồi. Yêu cầu vẫn được giữ để thử lại khi có mạng.',
  'vault-opened': 'Kho lịch sử đã được mở khóa.',
  'vault-locked': 'Kho lịch sử đã khóa.',
  'vault-unlock-failed': 'Chưa mở được kho lịch sử. Kiểm tra mật khẩu rồi thử lại.',
  'vault-record-deleted': 'Đã xóa một phiên khỏi kho mã hóa trên thiết bị.',
  'vault-cleared': 'Đã xóa toàn bộ kho lịch sử trên thiết bị.',
  'vault-exported': 'Đã xuất văn bản của một phiên theo thao tác của bạn.',
  'vault-operation-failed': 'Chưa hoàn tất được thao tác với kho lịch sử.',
  'vault-save-succeeded': 'Phụ đề đã được lưu trong kho mã hóa trên thiết bị.',
  'vault-save-failed': 'Chưa lưu được nội dung vào kho trên thiết bị.',
  'worker-failed': 'Một nhánh xử lý AI đã gặp lỗi.',
  'performance-pressure': 'Thiết bị đang bận; SignEmo đã giảm tải xử lý.',
  'video-test-file-selected': 'Bạn đã chọn video để kiểm thử trên thiết bị.',
  'video-test-reference-opened': 'Đã mở video tham khảo. AI chỉ phân tích tệp trên thiết bị.',
  'video-test-branch-ready': 'Một nhánh AI cho video đã sẵn sàng.',
  'video-test-started': 'Kiểm thử video đã bắt đầu.',
  'video-test-resumed': 'Kiểm thử video đã tiếp tục.',
  'video-test-paused': 'Kiểm thử video đã tạm dừng.',
  'video-test-seeked': 'Bạn đã tua video kiểm thử.',
  'video-test-finished': 'Kiểm thử video đã hoàn tất.',
  'video-test-failed':
    'Một nhánh xử lý video chưa hoạt động. Mở Nhật ký hoạt động để xem bước bị ảnh hưởng.',
  'update-available': 'Có phiên bản SignEmo mới.',
  'app-error': 'Ứng dụng gặp lỗi ngoài dự kiến. Mở Nhật ký hoạt động để xem bước bị ảnh hưởng.',
  'log-storage-unavailable': 'Không ghi thêm được nhật ký vào bộ nhớ của trình duyệt.',
};

export function auditMessage(event: Pick<AuditEvent, 'code' | 'details'>) {
  if (
    event.code === 'ai-preparation-failed' &&
    (event.details.branch === 'speech' || event.details.branch === 'face')
  ) {
    const branch = event.details.branch === 'speech' ? 'phụ đề tiếng Việt' : 'nhận diện khuôn mặt';
    const reason =
      event.details.reason === 'timeout'
        ? 'quá thời gian khởi tạo'
        : event.details.reason === 'unsupported-browser'
          ? 'trình duyệt chưa hỗ trợ hoặc đang chặn bộ xử lý'
          : event.details.reason === 'storage'
            ? 'chưa lưu được model'
            : event.details.reason === 'offline'
              ? 'mất kết nối khi chuẩn bị'
              : 'worker chưa hoạt động';
    return `Chưa khởi tạo được ${branch}: ${reason}.`;
  }
  if (event.code === 'asr-model-ready') {
    if (event.details.modelProfile === 'gipformer1.5-int8')
      return 'Gipformer tiếng Việt đã sẵn sàng trong bản thử nghiệm.';
    if (event.details.modelProfile === 'whisper-tiny-q8')
      return 'PhoWhisper chưa khởi chạy được; đang dùng Whisper tiny dự phòng.';
    if (event.details.modelProfile === 'phowhisper-tiny-q8')
      return 'PhoWhisper-tiny tiếng Việt đã sẵn sàng trên thiết bị.';
    if (event.details.modelProfile === 'moonshine-streaming-tiny-vi-research')
      return 'Moonshine Streaming tiếng Việt đã sẵn sàng trong chế độ thử nghiệm local.';
  }
  if (event.code === 'asr-performance' && event.details.durationMs !== undefined) {
    const rtf = event.details.rtf === undefined ? '' : `, RTF ${event.details.rtf.toFixed(2)}`;
    return `Đã ghi nhận thời gian xử lý phụ đề ${event.details.durationMs} ms${rtf}. Không lưu nội dung lời nói.`;
  }
  if (event.code === 'worker-failed' && event.details.branch === 'voice')
    return 'Nhánh tone thử nghiệm gặp lỗi; phụ đề vẫn tiếp tục.';
  if (event.code === 'worker-failed' && event.details.branch === 'text')
    return 'Nhánh sắc thái văn bản gặp lỗi; phụ đề vẫn tiếp tục.';
  if (event.code === 'page-opened' && event.details.page)
    return `Bạn đã mở ${pageName[event.details.page]}.`;
  if (event.code === 'preparation-progress' && event.details.percent !== undefined)
    return `Đã chuẩn bị ${event.details.percent}% tài nguyên.`;
  if (event.code === 'preparation-failed' && event.details.branch === 'emotion')
    return 'Chưa mở được gợi ý tổng hợp. Phụ đề và biểu cảm mặt vẫn hoạt động.';
  if (event.code === 'permission-failed') {
    if (event.details.reason === 'permission-denied')
      return 'Trình duyệt chưa cấp quyền camera hoặc micro. Hãy cho phép cả hai rồi thử lại.';
    if (event.details.reason === 'device-missing')
      return 'Không tìm thấy camera hoặc micro. Kết nối thiết bị rồi thử lại.';
    if (event.details.reason === 'device-busy')
      return 'Camera hoặc micro đang được ứng dụng khác sử dụng. Đóng ứng dụng đó rồi thử lại.';
  }
  if (event.code === 'worker-failed' && event.details.branch === 'emotion')
    return 'Nhánh gợi ý tổng hợp gặp lỗi. Phụ đề vẫn tiếp tục.';
  if (event.code === 'performance-pressure' && event.details.enabled === false)
    return 'Thiết bị đã ổn định; SignEmo khôi phục tốc độ nhận diện khuôn mặt.';
  return copy[event.code];
}

export function auditLevel(code: AuditCode): AuditLevel {
  if (
    code === 'ai-preparation-failed' ||
    code === 'permission-failed' ||
    code === 'app-error' ||
    code === 'report-send-failed' ||
    code === 'report-withdraw-failed' ||
    code === 'vault-save-failed' ||
    code === 'vault-operation-failed'
  )
    return 'error';
  if (code === 'vault-unlock-failed') return 'warning';
  if (
    code.includes('failed') ||
    code === 'startup-interrupted' ||
    code === 'background-stopped' ||
    code === 'pagehide-stopped' ||
    code === 'performance-pressure' ||
    code === 'log-storage-unavailable'
  )
    return 'warning';
  return 'info';
}

export function auditReasonFromName(name: string): AuditReason {
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'permission-denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'device-missing';
  if (name === 'NotReadableError' || name === 'AbortError') return 'device-busy';
  if (name === 'NotSupportedError' || name === 'SecurityError') return 'unsupported-browser';
  if (name === 'TimeoutError') return 'timeout';
  if (name === 'QuotaExceededError') return 'storage';
  if (name === 'NetworkError' || name === 'TypeError') return 'offline';
  return 'unknown';
}

export const pageName: Record<AuditPage, string> = {
  conversation: 'Hội thoại',
  history: 'Lịch sử',
  home: 'Giới thiệu',
  practice: 'Luyện nhịp',
  feedback: 'Phản hồi',
  settings: 'Cài đặt',
  activity: 'Nhật ký hoạt động',
  admin: 'Quản trị pilot',
  lab: 'Phòng kiểm thử video',
  'speech-lab': 'Phòng kiểm thử tiếng nói',
};
