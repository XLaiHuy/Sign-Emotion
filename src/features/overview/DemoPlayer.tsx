import { useEffect, useRef, useState } from 'react';
import { Download, Play } from 'lucide-react';
import { introVideo, introCaptions } from '../../shared/optionalMedia';
import { optionalMediaSaved, saveOptionalMedia } from '../../infrastructure/offline/optionalMedia';

/** Local media is requested only after a play/save gesture. */
export function DemoPlayer() {
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const savingRequest = useRef<AbortController | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const node = video.current;
    return () => {
      if (node) {
        node.pause();
        node.removeAttribute('src');
        node.load();
      }
    };
  }, [playing, failed]);
  useEffect(() => {
    let active = true;
    void Promise.all([introVideo, introCaptions].map(optionalMediaSaved)).then((values) => {
      if (active) setSaved(values.every(Boolean));
    });
    const update = () => setOffline(!navigator.onLine);
    const pause = () => {
      if (document.hidden) video.current?.pause();
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    document.addEventListener('visibilitychange', pause);
    return () => {
      active = false;
      savingRequest.current?.abort();
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      document.removeEventListener('visibilitychange', pause);
    };
  }, []);
  const save = async () => {
    const request = new AbortController();
    savingRequest.current = request;
    setSaving(true);
    setMessage('');
    try {
      await saveOptionalMedia(introVideo, request.signal);
      await saveOptionalMedia(introCaptions, request.signal);
      if (!request.signal.aborted) {
        setSaved(true);
        setMessage('Đã lưu clip để xem offline.');
      }
    } catch (error) {
      if (!request.signal.aborted)
        setMessage(
          error instanceof Error
            ? error.message
            : 'Chưa lưu được clip. Bạn vẫn có thể vào hội thoại.',
        );
    } finally {
      if (!request.signal.aborted) setSaving(false);
    }
  };
  return (
    <figure className="demo-preview intro-video" aria-label="Video giới thiệu SignEmo">
      <div className="intro-video-stage">
        {playing && !failed ? (
          <video
            ref={video}
            src={introVideo.url}
            controls
            playsInline
            preload="metadata"
            poster="/demo/signemo-poster.svg"
            aria-label="Clip minh họa SignEmo"
            onError={() => {
              setFailed(true);
              setPlaying(false);
              setMessage('Chưa phát được clip. Bạn có thể thử lại hoặc mở YouTube khi có mạng.');
            }}
          >
            <track
              kind="captions"
              src={introCaptions.url}
              srcLang="vi"
              label="Tiếng Việt · bản nháp"
              default
            />
          </video>
        ) : (
          <img
            src="/demo/signemo-poster.svg"
            alt="Minh họa SignEmo với phụ đề và gợi ý sắc thái."
          />
        )}
      </div>
      {!playing && (
        <button
          className="button primary intro-video-play"
          disabled={offline && !saved}
          onClick={() => {
            setFailed(false);
            setPlaying(true);
            setMessage('');
          }}
        >
          <Play size={18} aria-hidden="true" />{' '}
          {failed ? 'Thử xem lại video' : 'Xem video giới thiệu'}
        </button>
      )}
      <div className="optional-media-actions">
        <button
          type="button"
          className="button secondary"
          disabled={saving || saved || offline}
          onClick={() => void save()}
        >
          <Download size={18} aria-hidden="true" />{' '}
          {saving ? 'Đang lưu clip…' : saved ? 'Đã lưu offline' : 'Lưu clip để xem offline'}
        </button>
        <a
          href="https://www.youtube.com/watch?v=g6lhRElRiWs"
          target="_blank"
          rel="noopener noreferrer"
        >
          Mở trên YouTube
        </a>
      </div>
      <figcaption>
        Phụ đề clip là bản nháp cần soát lời/timecode.{' '}
        {offline && !saved
          ? 'Clip chưa lưu offline. Hướng dẫn bằng chữ vẫn có sẵn; hội thoại không bị chặn. '
          : 'Clip minh họa, không phải bằng chứng độ chính xác. Bấm nút phát trong video để xem. '}
        <span role="status">{message}</span>
      </figcaption>
    </figure>
  );
}
