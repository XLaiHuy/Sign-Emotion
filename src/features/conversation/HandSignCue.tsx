import { useEffect, useRef, useState } from 'react';
import { expressionUI, type Expression } from '../../shared/contracts';
import { signVideos, type SignVideoAsset } from '../../shared/optionalMedia';
import { saveOptionalMedia } from '../../infrastructure/offline/optionalMedia';
import { ExpressionMotion } from './ExpressionMotion';

export interface FaceCue {
  id: number;
  label: Expression;
  timestamp: number;
}

export function HandSignCue({
  cue,
  label,
  active,
  enabled,
  assets = signVideos,
}: {
  cue: FaceCue | null;
  label: Expression | null;
  active: boolean;
  enabled: boolean;
  assets?: readonly SignVideoAsset[];
}) {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  const [playback, setPlayback] = useState<FaceCue | null>(null);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const latest = useRef({ active, enabled, label });
  latest.current = { active, enabled, label };
  const pending = useRef<FaceCue | null>(null);
  const playing = useRef(false);
  const video = useRef<HTMLVideoElement>(null);
  const saveRequest = useRef<AbortController | null>(null);
  const asset = assets.find((item) => item.expression === (playback?.label ?? label));
  useEffect(() => {
    const node = video.current;
    return () => {
      if (node) {
        node.pause();
        node.removeAttribute('src');
        node.load();
      }
    };
  }, [playback?.id]);
  const stop = () => {
    const node = video.current;
    if (node) {
      node.pause();
      node.removeAttribute('src');
      node.load();
    }
    playing.current = false;
    pending.current = null;
    setPlayback(null);
  };
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media?.matches ?? false);
    media?.addEventListener('change', update);
    const hide = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', stop);
    return () => {
      saveRequest.current?.abort();
      media?.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', stop);
      const node = video.current;
      if (node) {
        node.pause();
        node.removeAttribute('src');
        node.load();
      }
    };
  }, []);
  useEffect(() => {
    if (!active || !enabled || reduced || !label || label === 'neutral') stop();
  }, [active, enabled, reduced, label]);
  useEffect(() => {
    if (
      !cue ||
      !active ||
      !enabled ||
      reduced ||
      document.hidden ||
      cue.label === 'neutral' ||
      cue.label !== label ||
      performance.now() - cue.timestamp > 3000 ||
      !assets.some((item) => item.expression === cue.label)
    )
      return;
    setFailed(false);
    if (playing.current) pending.current = cue;
    else {
      playing.current = true;
      setPlayback(cue);
    }
  }, [cue, active, enabled, reduced, label, assets]);
  const finish = () => {
    playing.current = false;
    const next = pending.current;
    pending.current = null;
    if (
      next &&
      latest.current.active &&
      latest.current.enabled &&
      next.label === latest.current.label &&
      performance.now() - next.timestamp <= 3000 &&
      !document.hidden
    ) {
      playing.current = true;
      setPlayback(next);
    } else setPlayback(null);
  };
  if (!enabled) return null;
  const currentLabel = playback?.label ?? label;
  return (
    <section className="sign-cue" aria-label={asset ? 'Ký hiệu tên biểu cảm' : 'Minh họa biểu cảm'}>
      <h3>{asset ? 'Ký hiệu tên biểu cảm' : 'Minh họa biểu cảm'}</h3>
      {playback && asset && active && !failed ? (
        <video
          key={playback.id}
          ref={video}
          src={asset.url}
          muted
          autoPlay
          playsInline
          preload="metadata"
          controls
          aria-label={`Ký hiệu ${expressionUI[playback.label].name} · TP.HCM`}
          onEnded={finish}
          onError={() => {
            setFailed(true);
            stop();
          }}
        />
      ) : !asset || failed ? (
        <ExpressionMotion label={label} active={active} cue={cue} reduced={reduced} />
      ) : (
        <p className="sign-cue-label">
          {currentLabel
            ? `${expressionUI[currentLabel].icon} ${expressionUI[currentLabel].name}`
            : 'Chưa có biểu cảm rõ'}
          <small>
            {asset && !failed
              ? 'Ký hiệu TP.HCM · bấm xem lại khi cần.'
              : 'Minh họa biểu cảm · không phải ngôn ngữ ký hiệu.'}
          </small>
        </p>
      )}
      {asset && active && label && label !== 'neutral' && (
        <>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              stop();
              setFailed(false);
              playing.current = true;
              setPlayback({ id: Date.now(), label, timestamp: performance.now() });
            }}
          >
            Xem lại ký hiệu
          </button>
          <button
            type="button"
            className="text-button"
            disabled={saving}
            onClick={async () => {
              const request = new AbortController();
              saveRequest.current = request;
              setSaving(true);
              setMessage('');
              try {
                await saveOptionalMedia(asset, request.signal);
                if (!request.signal.aborted) setMessage('Đã lưu ký hiệu để xem offline.');
              } catch {
                if (!request.signal.aborted)
                  setMessage('Chưa lưu được video ký hiệu. Phụ đề vẫn hoạt động.');
              } finally {
                if (!request.signal.aborted) setSaving(false);
              }
            }}
          >
            {saving ? 'Đang lưu…' : 'Lưu ký hiệu offline'}
          </button>
          <small>
            {asset.attribution} ·{' '}
            <a href={asset.source} target="_blank" rel="noopener noreferrer">
              Nguồn ký hiệu
            </a>
          </small>
        </>
      )}
      <p role="status" className="fine-note">
        {message}
      </p>
    </section>
  );
}
