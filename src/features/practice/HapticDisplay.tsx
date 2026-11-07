import type { HapticVisual } from './useHaptics';
import { expressionUI } from '../../shared/contracts';
export function HapticDisplay({
  visual,
  compact = false,
}: {
  visual: HapticVisual;
  compact?: boolean;
}) {
  return (
    <div
      className={`haptic-display ${compact ? 'haptic-compact' : ''} ${visual.active ? 'haptic-beat-on' : ''}`}
      aria-label="Nhịp phản hồi"
    >
      {!compact && visual.label && (
        <strong>
          {expressionUI[visual.label].icon} {expressionUI[visual.label].name}
        </strong>
      )}
      <div
        className={`pulse-orb ${visual.active ? 'on' : ''}`}
        aria-label={visual.active ? 'Nhịp đang bật' : 'Nhịp đang nghỉ'}
      >
        <span className="pulse-orb-ring" aria-hidden="true" />
        <span className="pulse-orb-glyph" aria-hidden="true">
          〰
        </span>
      </div>
      <div
        className={`rhythm-track${!visual.pattern.length ? ' rhythm-track-idle' : ''}`}
        aria-hidden="true"
      >
        {visual.pattern.length ? (
          visual.pattern.map((duration, i) => (
            <span
              key={i}
              className={`${i % 2 ? 'rest' : 'beat'} ${visual.index === i ? 'current' : ''}`}
              style={{ flex: duration }}
            />
          ))
        ) : (
          <>
            <span className="beat idle-node" style={{ flex: 1 }} />
            <span className="rest idle-node" style={{ flex: 0.6 }} />
            <span className="beat idle-node" style={{ flex: 2.2 }} />
            <span className="rest idle-node" style={{ flex: 0.6 }} />
            <span className="beat idle-node" style={{ flex: 1 }} />
          </>
        )}
      </div>
      <small aria-live="polite">
        {visual.playing
          ? visual.output === 'audio'
            ? 'Đang phát âm thanh'
            : visual.output === 'vibration'
              ? 'Đã gửi yêu cầu rung'
              : 'Đang mô phỏng bằng hình ảnh'
          : visual.label
            ? visual.output === 'audio'
              ? 'Đã phát âm thanh'
              : visual.output === 'vibration'
                ? 'Đã gửi yêu cầu rung'
                : 'Đã mô phỏng bằng hình ảnh'
            : 'Chờ gợi ý'}
      </small>
    </div>
  );
}
