import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { expressionUI, expressions, type Expression } from '../../shared/contracts';
import { AvatarPanel } from './AvatarPanel';
import { ExpressionMotion } from './ExpressionMotion';
import type { FaceCue } from './HandSignCue';
import { emotionSurfaces } from '../../shared/ui/emotionAppearance';

export function FaceIllustration({
  label,
  active,
  cue,
  use3D,
  allowed3D,
  colors,
}: {
  label: Expression | null;
  active: boolean;
  cue: FaceCue | null;
  use3D: boolean;
  allowed3D: boolean;
  colors: boolean;
}) {
  const [visible, setVisible] = useState(!document.hidden);
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  const [failed, setFailed] = useState(false),
    [ready, setReady] = useState(false),
    [replay, setReplay] = useState(0);
  const unavailable = useCallback(() => {
    setFailed(true);
    setReady(false);
  }, []);
  const prepared = useCallback(() => setReady(true), []);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(media?.matches ?? false);
    const visibility = () => setVisible(!document.hidden);
    const hide = () => setVisible(false);
    media?.addEventListener('change', motion);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', hide);
    return () => {
      media?.removeEventListener('change', motion);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', hide);
    };
  }, []);
  useEffect(() => {
    setFailed(false);
    setReady(false);
  }, [use3D]);
  const current = active && visible ? label : null;
  const render3D = !!current && use3D && allowed3D && !failed;
  const ui = current ? expressionUI[current] : null;
  const accent = colors && ui ? ui.color : '#426854';
  const fallback = (
    <ExpressionMotion label={current} active={!!current} cue={cue} reduced={reduced} />
  );
  return (
    <section
      className={`face-illustration${colors && current ? ' face-illustration-coloured' : ''}`}
      aria-label="Minh họa nét mặt"
      style={
        {
          '--face-accent': accent,
          '--face-surface': colors && current ? emotionSurfaces[current] : '#f7f6f1',
        } as CSSProperties
      }
    >
      <div className="face-illustration-stage">
        {render3D ? (
          <>
            <div className="face-illustration-3d" role="img" aria-label={`Đầu 3D · ${ui!.name}`}>
              <AvatarPanel
                expression={current}
                active
                reduced={reduced}
                replay={replay}
                fallback={fallback}
                onUnavailable={unavailable}
                onReady={prepared}
              />
            </div>
            <div className="face-illustration-copy">
              <strong className="face-expression-label">
                Nét mặt: {ui!.icon} {ui!.name}
              </strong>
              <small>Minh họa thử nghiệm, có thể sai.</small>
              {ready && current !== 'neutral' && !reduced && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setReplay((value) => value + 1)}
                >
                  Xem lại minh họa
                </button>
              )}
            </div>
          </>
        ) : (
          fallback
        )}
      </div>
      {use3D && current && (!allowed3D || failed) && (
        <p className="fine-note" role="status">
          Đang dùng hình 2D để giữ phụ đề hoạt động.
        </p>
      )}
      <details className="emotion-color-legend">
        <summary>Chú giải màu và nguồn gợi ý</summary>
        <ul>
          {expressions.map((item) => (
            <li key={item}>
              <span
                aria-hidden="true"
                className="emotion-color-dot"
                style={{ backgroundColor: colors ? expressionUI[item].color : '#426854' }}
              />
              <span>
                {expressionUI[item].icon} {expressionUI[item].name}
              </span>
            </li>
          ))}
        </ul>
        <p className="fine-note">
          Avatar theo nét mặt hiện tại. Màu cạnh câu chỉ theo tổng hợp của câu đó. Sợ hãi không phải
          cảnh báo nguy hiểm. Minh họa khuôn mặt không phải ngôn ngữ ký hiệu.
        </p>
      </details>
    </section>
  );
}
