export type ModelInitializationCode =
  'worker' | 'timeout' | 'network' | 'storage' | 'integrity' | 'gpu' | 'wasm' | 'memory';
const codes = new Set<ModelInitializationCode>([
  'worker',
  'timeout',
  'network',
  'storage',
  'integrity',
  'gpu',
  'wasm',
  'memory',
]);
export class ModelInitializationError extends Error {
  constructor(readonly code: ModelInitializationCode) {
    super(code);
    this.name = 'ModelInitializationError';
  }
}
/** Exception text is inspected locally only; never propagated to audit or product UI. */
export function modelInitializationCode(error: unknown): ModelInitializationCode {
  if (error instanceof ModelInitializationError) return error.code;
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'QuotaExceededError'
  )
    return 'storage';
  if (error instanceof Error) {
    if (error.name === 'QuotaExceededError') return 'storage';
    if (/out of memory|allocation failed|memory access out of bounds/i.test(error.message))
      return 'memory';
    if (
      /WebAssembly.*(?:disallow|disabled|not defined)|wasm code generation|unsafe-eval/i.test(
        error.message,
      )
    )
      return 'wasm';
    if (error instanceof TypeError && /fetch|network|load failed/i.test(error.message))
      return 'network';
  }
  return 'worker';
}
export function workerInitializationCode(value: unknown): ModelInitializationCode {
  return typeof value === 'string' && codes.has(value as ModelInitializationCode)
    ? (value as ModelInitializationCode)
    : 'worker';
}
export function modelInitializationMessage(
  branch: 'speech' | 'face' | 'assets',
  code: ModelInitializationCode,
) {
  const name =
    branch === 'speech'
      ? 'phụ đề tiếng Việt'
      : branch === 'face'
        ? 'nhận diện khuôn mặt'
        : 'gói AI';
  if (code === 'gpu')
    return 'Chưa dùng được tăng tốc nhận diện khuôn mặt trên trình duyệt này. Hãy chọn chế độ tương thích.';
  if (code === 'wasm')
    return 'Trình duyệt đang chặn bộ xử lý AI. Hãy kiểm tra chế độ bảo mật của riêng trang này hoặc thử Chrome.';
  if (code === 'storage')
    return 'Trình duyệt chưa lưu được gói AI. Hãy kiểm tra dung lượng trống và quyền lưu dữ liệu của trang.';
  if (code === 'memory') return 'Thiết bị chưa đủ bộ nhớ để mở AI. Hãy đóng bớt tab rồi thử lại.';
  if (code === 'network')
    return `Mất kết nối khi chuẩn bị ${name}. Giữ mạng ổn định rồi thử lại; các file đã tải đủ vẫn được giữ.`;
  if (code === 'integrity')
    return `Gói ${name} chưa đầy đủ hoặc không khớp. Hãy thử chuẩn bị lại gói này.`;
  if (code === 'timeout') return `Khởi tạo ${name} quá lâu. Hãy đóng bớt tab rồi thử lại.`;
  return `Chưa khởi tạo được ${name} trên thiết bị. Hãy thử chuẩn bị lại.`;
}
export function modelInitializationAuditReason(code: ModelInitializationCode) {
  if (code === 'timeout') return 'timeout' as const;
  if (code === 'network') return 'offline' as const;
  if (code === 'storage') return 'storage' as const;
  if (code === 'gpu' || code === 'wasm') return 'unsupported-browser' as const;
  return 'worker-failed' as const;
}
