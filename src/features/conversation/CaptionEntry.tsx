import { memo, type CSSProperties } from 'react';
import { Hand } from 'lucide-react';
import type { FusionDecision, TranscriptSegment } from '../../domain/conversation';
import { expressionUI } from '../../shared/contracts';
import { emotionSurfaces } from '../../shared/ui/emotionAppearance';
import type { SignPhraseItem } from '../../domain/signPhrases';

/** Only a decision attached to this final segment may style it. */
export const CaptionEntry = memo(function CaptionEntry({
  segment,
  decision,
  colors,
  signLanguageCues = true,
  signPhrase,
  onViewSign,
}: {
  segment: TranscriptSegment;
  decision?: FusionDecision;
  colors: boolean;
  signLanguageCues?: boolean;
  signPhrase?: SignPhraseItem;
  onViewSign?: (phrase: SignPhraseItem) => void;
}) {
  const label =
    decision?.segmentId === segment.id && decision.reason === 'agreement' ? decision.label : null;
  const ui = label ? expressionUI[label] : null;

  return (
    <div
      className={`caption-entry${colors && ui ? ' caption-entry-accented' : ''}`}
      style={
        colors && ui
          ? ({
              '--emotion-accent': ui.color,
              '--emotion-surface': emotionSurfaces[label!],
            } as CSSProperties)
          : undefined
      }
    >
      <div className="caption-entry-header">
        {ui && (
          <small className="caption-context caption-emotion-badge">
            <span aria-hidden="true">{ui.icon}</span> {ui.name} · gợi ý thử nghiệm cho đoạn này
          </small>
        )}
        {signLanguageCues && signPhrase && onViewSign && (
          <button
            type="button"
            className="caption-sign-btn"
            onClick={() => onViewSign(signPhrase)}
            aria-label={`Xem ký hiệu cho câu: ${segment.text}`}
          >
            <Hand size={16} />
            <span>Xem ký hiệu</span>
          </button>
        )}
      </div>

      <p className="caption-text">{segment.text}</p>
      {segment.rawText && (
        <details className="caption-original">
          <summary>Văn bản nhận dạng ban đầu</summary>
          <p>{segment.rawText}</p>
        </details>
      )}
    </div>
  );
});
