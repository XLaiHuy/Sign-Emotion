import { useEffect, useState } from 'react';
import { expressionUI, type Expression } from '../../shared/contracts';
import type { FaceCue } from './HandSignCue';

const poses: Record<Expression, { mouth: string; left: string; right: string }> = {
  happy: {
    mouth: 'M35 61 C40 73 60 73 65 61 C60 73 40 73 35 61',
    left: 'M28 36 Q35 31 42 36',
    right: 'M58 36 Q65 31 72 36',
  },
  sad: {
    mouth: 'M36 72 C42 60 58 60 64 72 C58 60 42 60 36 72',
    left: 'M28 37 Q35 35 42 32',
    right: 'M58 32 Q65 35 72 37',
  },
  angry: {
    mouth: 'M37 69 C43 64 57 64 63 69 C57 64 43 64 37 69',
    left: 'M28 31 Q35 34 42 38',
    right: 'M58 38 Q65 34 72 31',
  },
  surprised: {
    mouth: 'M44 62 C44 52 56 52 56 62 C56 76 44 76 44 62',
    left: 'M28 29 Q35 24 42 29',
    right: 'M58 29 Q65 24 72 29',
  },
  fear: {
    mouth: 'M39 66 C43 54 57 54 61 66 C57 75 43 75 39 66',
    left: 'M28 32 Q35 28 42 27',
    right: 'M58 27 Q65 28 72 32',
  },
  disgust: {
    mouth: 'M36 67 C44 53 55 76 64 63 C55 76 44 53 36 67',
    left: 'M28 35 Q35 34 42 33',
    right: 'M58 30 Q65 32 72 36',
  },
  neutral: {
    mouth: 'M38 66 C44 66 56 66 62 66 C56 66 44 66 38 66',
    left: 'M28 34 Q35 34 42 34',
    right: 'M58 34 Q65 34 72 34',
  },
};

/** Illustrative face geometry, not a sign-language gesture or another prediction. */
export function ExpressionMotion({
  label,
  active,
  cue,
  reduced,
}: {
  label: Expression | null;
  active: boolean;
  cue: FaceCue | null;
  reduced: boolean;
}) {
  const [visible, setVisible] = useState(!document.hidden);
  const [replay, setReplay] = useState(0);
  useEffect(() => setReplay(0), [label, active, visible, reduced]);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    const hide = () => setVisible(false);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('pagehide', hide);
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('pagehide', hide);
    };
  }, []);
  const current = active && visible ? label : null;
  const pose = poses[current ?? 'neutral'];
  const animate = Boolean(
    current &&
    current !== 'neutral' &&
    !reduced &&
    (replay || (cue?.label === current && performance.now() - cue.timestamp <= 3000)),
  );
  return (
    <div className="expression-motion">
      <svg
        key={`${current}-${cue?.id}-${replay}-${animate}`}
        viewBox="0 0 100 100"
        className={`expression-motion-face${animate ? ' expression-motion-once' : ''}`}
        role="img"
        aria-label={current ? `Minh họa ${expressionUI[current].name}` : 'Chưa có biểu cảm rõ'}
      >
        <circle cx="50" cy="50" r="43" fill="#edf1e9" stroke="currentColor" strokeWidth="2" />
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {(['left', 'right', 'mouth'] as const).map((part) => (
            <path key={part} d={pose[part]}>
              {animate && (
                <animate
                  attributeName="d"
                  from={poses.neutral[part]}
                  to={pose[part]}
                  dur="0.45s"
                  repeatCount="1"
                  fill="freeze"
                />
              )}
            </path>
          ))}
        </g>
        <g fill="currentColor">
          <ellipse
            cx="35"
            cy="46"
            rx="3"
            ry={current === 'fear' || current === 'surprised' ? 5 : 3}
          />
          <ellipse
            cx="65"
            cy="46"
            rx="3"
            ry={current === 'fear' || current === 'surprised' ? 5 : 3}
          />
        </g>
      </svg>
      <div>
        <p className="sign-cue-label">
          {current ? `Nét mặt: ${expressionUI[current].name}` : 'Chưa có biểu cảm rõ'}
        </p>
        <small>Minh họa thử nghiệm, có thể sai.</small>
        {current && current !== 'neutral' && !reduced && (
          <button
            type="button"
            className="text-button"
            onClick={() => setReplay((value) => value + 1)}
          >
            Xem lại minh họa
          </button>
        )}
      </div>
    </div>
  );
}
