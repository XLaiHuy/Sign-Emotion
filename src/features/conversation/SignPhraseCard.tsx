import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Pause, Play, RotateCcw, X } from 'lucide-react';
import type { SignPhraseItem } from '../../domain/sign/signPhrasesCatalogue';
import { eligibleSignAsset } from '../../domain/sign/signAsset';
import { readSignAsset } from '../../infrastructure/media/signAssets';

const SignMotion = lazy(() => import('./SignMotion'));
export interface SignPhraseCardProps {
  phrase: SignPhraseItem;
  onClose: () => void;
  onActive?: (active: boolean) => void;
  onEnd?: () => void;
}
export function SignPhraseCard({ phrase, onClose, onActive, onEnd }: SignPhraseCardProps) {
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(
    () => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  const [expanded, setExpanded] = useState(false);
  const [replay, setReplay] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const latest = useRef(onEnd);
  latest.current = onEnd;
  const end = useCallback(() => {
    setPlaying(false);
    latest.current?.();
  }, []);
  const error = useCallback(() => {
    setFailed(true);
    setPlaying(false);
    latest.current?.();
  }, []);
  useEffect(() => {
    if (!eligibleSignAsset(phrase.asset)) return;
    const abort = new AbortController();
    let objectUrl = '';
    onActive?.(true);
    setBytes(null);
    setUrl('');
    setFailed(false);
    void readSignAsset(phrase.asset, abort.signal)
      .then((data) => {
        if (abort.signal.aborted) return;
        if (phrase.asset!.kind === 'video') {
          objectUrl = URL.createObjectURL(new Blob([data], { type: 'video/mp4' }));
          setUrl(objectUrl);
        } else setBytes(data);
      })
      .catch(() => {
        if (!abort.signal.aborted) error();
      });
    return () => {
      abort.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      onActive?.(false);
    };
  }, [phrase, onActive, error]);
  useEffect(() => {
    if (!video.current || !url) return;
    if (playing) void video.current.play().catch(() => setPlaying(false));
    else video.current.pause();
  }, [url, playing]);
  useEffect(() => {
    if (!expanded || !card.current) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const siblings: { element: HTMLElement; inert: boolean }[] = [];
    let child: HTMLElement = card.current;
    while (child.parentElement) {
      for (const element of child.parentElement.children) {
        if (element instanceof HTMLElement && element !== child) {
          siblings.push({ element, inert: element.inert });
          element.inert = true;
        }
      }
      child = child.parentElement;
    }
    card.current.querySelector<HTMLButtonElement>('button')?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpanded(false);
        e.preventDefault();
      }
      if (e.key !== 'Tab') return;
      const buttons = [
        ...card.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
      ];
      const first = buttons[0],
        last = buttons.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        last?.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first?.focus();
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = overflow;
      siblings.forEach(({ element, inert }) => {
        element.inert = inert;
      });
      document.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, [expanded]);
  if (!eligibleSignAsset(phrase.asset)) return null;
  return (
    <div
      ref={card}
      className={`sign-phrase-card${expanded ? ' sign-phrase-expanded' : ''}`}
      role={expanded ? 'dialog' : 'region'}
      aria-modal={expanded || undefined}
      aria-label={`Ký hiệu câu: ${phrase.text}`}
    >
      <header className="sign-phrase-header">
        <p>{phrase.text}</p>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Đóng ký hiệu">
          <X size={20} />
        </button>
      </header>
      <div className="sign-phrase-stage">
        {failed ? (
          <p role="status">Chưa mở được mẫu ký hiệu. Hãy thử lại.</p>
        ) : url ? (
          <video
            ref={video}
            src={url}
            muted
            playsInline
            onEnded={end}
            onError={error}
            className="sign-phrase-video"
            aria-label={`Video ký hiệu: ${phrase.text}`}
          />
        ) : bytes ? (
          <Suspense fallback={<p>Đang mở ký hiệu…</p>}>
            <SignMotion
              bytes={bytes}
              clipName={phrase.asset.clipName}
              playing={playing}
              replay={replay}
              onEnd={end}
              onError={error}
            />
          </Suspense>
        ) : (
          <p role="status">Đang mở ký hiệu…</p>
        )}
      </div>
      <div className="sign-player-controls">
        <button
          type="button"
          className="button secondary"
          disabled={failed || (!bytes && !url)}
          onClick={() => setPlaying((v) => !v)}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />} {playing ? 'Tạm dừng' : 'Phát'}
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            if (failed) {
              onClose();
              return;
            }
            if (video.current) video.current.currentTime = 0;
            setReplay((v) => v + 1);
            setPlaying(true);
          }}
          disabled={failed || (!bytes && !url)}
        >
          <RotateCcw size={18} /> Phát lại
        </button>
        <button type="button" className="button secondary" onClick={() => setExpanded((v) => !v)}>
          {expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}{' '}
          {expanded ? 'Thu nhỏ' : 'Phóng to'}
        </button>
      </div>
      <small>Bản thử — chưa kiểm chứng.</small>
      <details className="sign-source">
        <summary>Nguồn mẫu</summary>
        <p>{phrase.asset.source}</p>
        <p>{phrase.asset.license}</p>
      </details>
    </div>
  );
}
