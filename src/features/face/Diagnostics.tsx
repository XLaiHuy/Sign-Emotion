import type { InferenceResult } from '../../shared/contracts';
export const EMOTION_LABELS = [
  'neutral',
  'happy',
  'surprised',
  'sad',
  'angry',
  'disgust',
  'fear',
  'contempt',
];
const reasons: Record<string, string> = {
  'invalid-input': 'Chưa có khung hình hợp lệ',
  'unsupported-class': 'Lớp ngoài phạm vi MVP',
  'low-score': 'Điểm model dưới ngưỡng',
  'small-margin': 'Hai lớp có điểm quá gần',
  stabilizing: 'Chưa đủ thời gian ổn định',
  cooldown: 'Đang trong khoảng nghỉ nhịp',
  'held-expression': 'Biểu cảm giữ nguyên; không lặp nhịp',
  neutral: 'Trung tính; không phát nhịp',
  'stable-change': 'Đủ điều kiện tạo nhịp',
  'auxiliary-uncertain': 'Model phụ chưa đủ chắc chắn',
  'face-too-small': 'Đưa camera gần mặt hơn',
  'face-outside': 'Đưa toàn bộ mặt vào khung',
  'face-angle': 'Nhìn thẳng hơn',
  'too-dark': 'Tăng ánh sáng phía trước mặt',
  'too-bright': 'Tránh ánh sáng quá mạnh',
  'low-contrast': 'Tránh ngược sáng hoặc hình ảnh mờ',
  blurred: 'Giữ camera ổn định hơn',
};
export function resultExplanation(result: InferenceResult) {
  if (result.decisionReason === 'stale-result')
    return 'Khung hình xử lý muộn; đang chờ quan sát mới';
  if (result.status === 'no-face') return 'Hướng camera về một khuôn mặt';
  if (result.status === 'multiple-faces') return 'Chỉ để một mặt trong khung';
  if (result.qualityWarning === 'blurred')
    return 'Ảnh hơi nhòe; giảm trọng số gợi ý mặt. Giữ camera ổn định hơn.';
  return reasons[result.qualityReason ?? result.decisionReason ?? ''] ?? 'Chưa xác định';
}
export function Diagnostics({ result }: { result: InferenceResult }) {
  return (
    <details className="diagnostics">
      <summary>Điểm model và lý do quyết định</summary>
      <p>
        {resultExplanation(result)} · {result.processingMs.toFixed(0)} ms/khung ·{' '}
        {result.modelVersion}
      </p>
      <div className="score-table">
        <table>
          <thead>
            <tr>
              <th>Lớp biểu cảm</th>
              <th>Điểm gốc</th>
              <th>Sau làm mượt</th>
            </tr>
          </thead>
          <tbody>
            {EMOTION_LABELS.map((name, i) => (
              <tr key={name}>
                <td>{name}</td>
                <td>{(result.rawScores?.[i] ?? result.scores[i] ?? 0).toFixed(3)}</td>
                <td>{(result.scores[i] ?? 0).toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.auxiliary && (
        <p>Model phụ neutral/sad: {result.auxiliary.scores.map((v) => v.toFixed(3)).join(' / ')}</p>
      )}
      <p>
        Điểm model không phải xác suất cảm xúc thật. Crop RGB 224×224, chuẩn hóa ImageNet rồi ánh xạ
        về thứ tự nhãn SignEmo; EMA theo thời gian (150 ms).
      </p>
    </details>
  );
}
