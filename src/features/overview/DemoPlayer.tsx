import { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, Pause, Play, Sparkles, X } from 'lucide-react';
import { introVideo, introCaptions, introYouTube } from '../../shared/optionalMedia';
import { optionalMediaSaved, saveOptionalMedia } from '../../infrastructure/offline/optionalMedia';

/** Short preview clip loops automatically (muted); Long clip opens full modal with YouTube player. */
export function DemoPlayer() {
  const [modalOpen, setModalOpen] = useState(false);
  const [previewPaused, setPreviewPaused] = useState(false);
  const [failed, setFailed] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const savingRequest = useRef<AbortController | null>(null);
  const video = useRef<HTMLVideoElement>(null);

  // Check prefers-reduced-motion on mount
  useEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    if (reducedMotion) {
      setPreviewPaused(true);
      video.current?.pause();
    }
  }, []);

  // Sync pause/resume of preview video when modal opens/closes or visibility changes
  useEffect(() => {
    const node = video.current;
    if (!node) return;
    if (modalOpen) {
      node.pause();
    } else if (!previewPaused && !failed && !document.hidden) {
      try {
        void node.play()?.catch?.(() => {});
      } catch {
        /* Non-supporting environments (e.g. jsdom) */
      }
    }
  }, [modalOpen, previewPaused, failed]);

  useEffect(() => {
    const node = video.current;
    return () => {
      if (node) {
        node.pause();
        node.removeAttribute('src');
        node.load();
      }
    };
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([introVideo, introCaptions].map(optionalMediaSaved)).then((values) => {
      if (active) setSaved(values.every(Boolean));
    });

    const updateOnline = () => setOffline(!navigator.onLine);
    const handleVisibility = () => {
      const node = video.current;
      if (!node) return;
      if (document.hidden) {
        node.pause();
      } else if (!modalOpen && !previewPaused && !failed) {
        try {
          void node.play()?.catch?.(() => {});
        } catch {
          /* Non-supporting environments */
        }
      }
    };

    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      savingRequest.current?.abort();
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [modalOpen, previewPaused, failed]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!modalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen]);

  const togglePreview = () => {
    const node = video.current;
    if (!node) return;
    if (node.paused) {
      try {
        void node.play()?.catch?.(() => {});
      } catch {
        /* Non-supporting environments */
      }
      setPreviewPaused(false);
    } else {
      node.pause();
      setPreviewPaused(true);
    }
  };

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
      <div className="intro-video-stage intro-preview-stage">
        {!failed ? (
          <video
            ref={video}
            src={introVideo.url}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/demo/signemo-poster.svg"
            aria-label="Clip minh họa SignEmo"
            onError={() => {
              setFailed(true);
              setMessage('Chưa phát được clip xem trước.');
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

        <div className="intro-preview-overlay">
          <span className="intro-preview-badge">
            <Sparkles size={13} aria-hidden="true" /> Clip xem trước
          </span>
          <button
            type="button"
            className="intro-preview-toggle-btn"
            onClick={togglePreview}
            aria-label={previewPaused ? 'Phát tiếp clip xem trước' : 'Tạm dừng clip xem trước'}
            title={previewPaused ? 'Phát' : 'Tạm dừng'}
          >
            {previewPaused ? (
              <Play size={14} aria-hidden="true" />
            ) : (
              <Pause size={14} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <button
        type="button"
        className="button primary intro-video-play"
        onClick={() => setModalOpen(true)}
      >
        <Play size={18} aria-hidden="true" /> Xem video giới thiệu (Bản đầy đủ)
      </button>

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
        <a href={introYouTube.longUrl} target="_blank" rel="noopener noreferrer">
          Mở trên YouTube
        </a>
      </div>

      <figcaption>
        Clip xem trước chạy tự động (tắt tiếng). Bấm nút &quot;Xem video giới thiệu&quot; để mở bản
        đầy đủ có thuyết minh và phụ đề.{' '}
        {offline && !saved
          ? 'Clip chưa lưu offline. Hướng dẫn bằng chữ vẫn có sẵn; hội thoại không bị chặn. '
          : 'Clip minh họa, không phải bằng chứng độ chính xác. '}
        <span role="status">{message}</span>
      </figcaption>

      {/* Modal Popup Full Video */}
      {modalOpen && (
        <div
          className="intro-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Video giới thiệu SignEmo — Bản đầy đủ"
        >
          <div className="intro-modal-dialog">
            <div className="intro-modal-header">
              <h3 className="intro-modal-title">Video giới thiệu SignEmo (Bản đầy đủ)</h3>
              <button
                type="button"
                className="intro-modal-close-btn"
                onClick={() => setModalOpen(false)}
                aria-label="Đóng video"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="intro-modal-body">
              {offline ? (
                <div className="intro-modal-offline" role="alert">
                  <p>Clip YouTube cần có kết nối mạng để phát.</p>
                  <p>
                    Hiện thiết bị đang ngoại tuyến. Bạn vẫn có thể xem clip ngắn hoặc vào Hội thoại
                    bình thường.
                  </p>
                </div>
              ) : (
                <div className="intro-modal-iframe-container">
                  <iframe
                    src={introYouTube.embedUrl}
                    title="Video giới thiệu SignEmo — YouTube"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="intro-modal-iframe"
                  />
                </div>
              )}
            </div>
            <div className="intro-modal-footer">
              <a
                href={introYouTube.longUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="button secondary"
              >
                <ExternalLink size={16} aria-hidden="true" /> Mở trên YouTube
              </a>
              <button type="button" className="button primary" onClick={() => setModalOpen(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </figure>
  );
}
