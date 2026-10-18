import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  Cpu,
  Eye,
  LockKeyhole,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Waves,
  Zap,
} from 'lucide-react';
import { DemoPlayer } from './DemoPlayer';
import { expressionUI, expressions, type Expression } from '../../shared/contracts';
import {
  retryModelPreparation,
  usePreparationStatus,
} from '../../infrastructure/offline/preparationStatus';
import { useHaptics } from '../practice/useHaptics';
import { loadSettings } from '../../infrastructure/storage/database';

interface HomePageProps {
  go: (page: 'conversation' | 'practice') => void;
  prepare: () => void;
  offline: boolean;
  preparing: boolean;
  progress: number;
  aiReady: boolean;
  aiFailed: boolean;
  aiFailureMessage?: string;
  isGpuFailure?: boolean;
  compatibleMode?: boolean;
  onUseCompatibleMode?: () => void;
  onRetrySpeedMode?: () => void;
}

export function HomePage({
  go,
  prepare,
  preparing,
  progress,
  aiReady,
  aiFailed,
  aiFailureMessage,
  isGpuFailure,
  compatibleMode,
  onUseCompatibleMode,
  onRetrySpeedMode,
}: HomePageProps) {
  const preparation = usePreparationStatus();
  const loading = preparation.preparing || preparing;
  const [selectedExpression, setSelectedExpression] = useState<Expression | null>('happy');
  const [soundFeedback, setSoundFeedback] = useState(true);

  useEffect(() => {
    let active = true;
    void loadSettings()
      .then((settings) => {
        if (active) setSoundFeedback(settings.soundFeedback);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.soundFeedback === 'boolean') {
        setSoundFeedback(detail.soundFeedback);
      }
    };
    window.addEventListener('signemo-settings-change', handler);
    return () => window.removeEventListener('signemo-settings-change', handler);
  }, []);

  const haptic = useHaptics('auto', soundFeedback);

  const playPattern = (label: Expression) => {
    if (label === 'neutral') {
      haptic.cancel();
      return;
    }
    void haptic.playFromGesture(label, 'practice');
  };

  return (
    <>
      <div className="eyebrow">SIGNEMO · ĐỒNG HÀNH GIAO TIẾP</div>
      <div className="page-heading">
        <div>
          <h1>Theo dõi hội thoại bằng phụ đề tiếng Việt.</h1>
          <p>
            Phụ đề xử lý hoàn toàn trên thiết bị. Icon, màu sắc và nhịp rung là gợi ý sắc thái thử
            nghiệm — hãy hỏi lại khi chưa rõ.
          </p>
        </div>
      </div>

      {/* Hero Metrics Strip */}
      <div className="hero-metrics-strip">
        <span className="hero-metric-item">
          <ShieldCheck size={14} /> Riêng tư trên thiết bị
        </span>
        <span className="hero-metric-item">
          <Zap size={14} /> Phụ đề tiếng Việt
        </span>
        <span className="hero-metric-item">
          <Eye size={14} /> Dễ đọc Deaf-First
        </span>
        <span className="hero-metric-item">
          <Waves size={14} /> Nhịp gợi ý
        </span>
      </div>

      <section className="card settings-card intro-welcome" aria-label="Bắt đầu trải nghiệm">
        <DemoPlayer />

        <div className="hero-action-panel">
          <div className="hero-cta-group">
            <button className="button primary hero-start-btn" onClick={() => go('conversation')}>
              Vào hội thoại <ArrowRight size={19} />
            </button>
            <button className="button secondary hero-practice-btn" onClick={() => go('practice')}>
              <Waves size={16} /> Luyện 6 nhịp
            </button>
          </div>

          <p className="fine-note">
            <LockKeyhole
              size={13}
              style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }}
            />
            Camera và micro chỉ mở sau khi bạn đồng ý và bấm bắt đầu.
          </p>

          {aiFailed && isGpuFailure && (
            <div className="gpu-fallback-card" role="alert">
              <div className="gpu-fallback-header">
                <AlertTriangle size={16} className="gpu-fallback-icon" />
                <span>
                  {aiFailureMessage ||
                    'Chưa dùng được tăng tốc nhận diện khuôn mặt trên trình duyệt này. Hãy chọn chế độ tương thích.'}
                </span>
              </div>
              <div className="gpu-fallback-actions">
                <button
                  className="button secondary gpu-compat-btn"
                  type="button"
                  onClick={onUseCompatibleMode}
                >
                  <Cpu size={15} style={{ marginRight: 6 }} />
                  Dùng chế độ tương thích
                </button>
                <button className="text-button" type="button" onClick={() => go('conversation')}>
                  Vào hội thoại
                </button>
              </div>
            </div>
          )}
          {aiFailed && !isGpuFailure && (
            <p role="alert">
              {aiFailureMessage || 'Chưa khởi tạo được AI trên thiết bị.'} Vào hội thoại để thử
              chuẩn bị lại.
            </p>
          )}
          {aiReady && compatibleMode && (
            <div className="compat-mode-banner" role="status">
              <span className="compat-mode-tag">
                <Cpu size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                Đang dùng chế độ tương thích cho khuôn mặt (CPU).
              </span>
              {onRetrySpeedMode && (
                <button
                  className="text-button inline-switch-btn"
                  type="button"
                  onClick={onRetrySpeedMode}
                >
                  <Sparkles size={13} style={{ marginRight: 4 }} />
                  Thử lại tăng tốc GPU
                </button>
              )}
            </div>
          )}
          {!aiFailed && (loading || preparation.error) && (
            <p role="status">
              {preparation.error ||
                `Đang chuẩn bị tài nguyên · ${preparation.preparing ? preparation.progress : progress}%${preparation.detail ? ` · ${preparation.detail}` : ''}`}
            </p>
          )}
          {!aiFailed && !loading && !preparation.error && !aiReady && (
            <p role="status">Vào Hội thoại để xem trạng thái chuẩn bị AI trên thiết bị.</p>
          )}
          {preparation.error && (
            <button
              className="text-button"
              onClick={() => {
                retryModelPreparation();
                prepare();
              }}
            >
              Thử chuẩn bị lại
            </button>
          )}

          {/* Stepper Journey */}
          <div className="stepper-journey-card">
            <span className="stepper-header-title">BA BƯỚC ĐỒNG HÀNH KHI BẮT ĐẦU:</span>
            <ol className="intro-steps stepper-steps">
              <li className="stepper-step">
                <div className="intro-step-num stepper-icon-box">
                  <CheckCircle2 size={16} />
                </div>
                <div className="intro-step-body stepper-text">
                  <strong>1. Cùng đồng ý</strong>
                  <p>Người đối diện biết camera và micro sẽ được sử dụng.</p>
                </div>
              </li>
              <li className="stepper-step">
                <div className="intro-step-num stepper-icon-box">
                  <Camera size={16} />
                </div>
                <div className="intro-step-body stepper-text">
                  <strong>2. Hướng camera về người nói</strong>
                  <p>Chọn nơi đủ sáng, giữ mặt trong khung.</p>
                </div>
              </li>
              <li className="stepper-step">
                <div className="intro-step-num stepper-icon-box">
                  <MessageSquare size={16} />
                </div>
                <div className="intro-step-body stepper-text">
                  <strong>3. Đọc phụ đề và hỏi lại</strong>
                  <p>Gợi ý có thể sai; không khẳng định cảm xúc hay ý định thật.</p>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section className="card settings-card" aria-label="Cách đọc gợi ý sắc thái">
        <h2>Đọc lời nói, xem gợi ý sắc thái</h2>
        <p>
          Đầu 3D minh họa nét mặt hiện tại bằng chuyển động mắt, mày và miệng. Icon, tên và màu giúp
          nhận biết nhanh; đây là gợi ý thử nghiệm, không khẳng định cảm xúc thật.
        </p>
        <p>
          Chữ phụ đề giữ màu tối để dễ đọc. Nhãn và viền cạnh một câu chỉ phản ánh tổng hợp của đúng
          câu đó, không đổi theo nét mặt đang xuất hiện sau này.
        </p>
        <p>
          Ký hiệu câu TP.HCM đang được nghiên cứu riêng. Minh họa nét mặt hiện tại chưa dịch lời nói
          sang ngôn ngữ ký hiệu.
        </p>
      </section>
      {/* 7 Expressions Showcase & Haptic Dial */}
      <details className="card settings-card palette-showcase-section" open>
        <summary>Làm quen với icon và nhịp</summary>
        <div className="palette-intro-text">
          <p>
            Chạm vào từng sắc thái để quan sát đặc điểm nét mặt và cảm nhận mô hình nhịp rung tương
            ứng.
            <span className="palette-device-note">
              (Máy tính mô phỏng bằng hình; âm báo cần bật riêng. Điện thoại chỉ rung khi được hỗ
              trợ.)
            </span>
          </p>
        </div>

        <div className="expression-grid" role="region" aria-label="Bảng 7 sắc thái cảm xúc">
          {expressions.map((label) => {
            const isSelected = selectedExpression === label;
            return (
              <div
                className={`expression-card ${isSelected ? 'is-selected' : ''}`}
                key={label}
                tabIndex={0}
                role="button"
                aria-label={`Xem chi tiết sắc thái ${expressionUI[label].name}`}
                onClick={() => {
                  setSelectedExpression(label);
                  playPattern(label);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setSelectedExpression(label);
                    playPattern(label);
                  }
                }}
              >
                {label !== 'neutral' && (
                  <span className="haptic-pulse-dot" title="Có mô hình nhịp rung xúc giác" />
                )}
                <span aria-hidden="true">{expressionUI[label].icon}</span>
                <strong style={{ color: expressionUI[label].color }}>
                  {expressionUI[label].name}
                </strong>
                <small>{expressionUI[label].short}</small>
              </div>
            );
          })}
        </div>

        {selectedExpression && (
          <div className="palette-detail-box" role="status" aria-live="polite">
            <div className="palette-detail-info">
              <span className="palette-detail-icon" aria-hidden="true">
                {expressionUI[selectedExpression].icon}
              </span>
              <div className="palette-detail-text">
                <h3 style={{ color: expressionUI[selectedExpression].color }}>
                  Sắc thái: {expressionUI[selectedExpression].name} ·{' '}
                  {expressionUI[selectedExpression].short}
                </h3>
                <p>
                  {selectedExpression === 'neutral'
                    ? 'Biểu cảm tự nhiên, bình thản · Trạng thái nghỉ, không kích hoạt nhịp rung.'
                    : `${expressionUI[selectedExpression].description} · Nhịp rung: ${expressionUI[selectedExpression].pattern.join('ms - ')}ms.`}
                </p>
                {selectedExpression !== 'neutral' && (
                  <div className="wave-diagram" aria-label={expressionUI[selectedExpression].short}>
                    {expressionUI[selectedExpression].pattern
                      .filter((_, i) => i % 2 === 0)
                      .map((n, i) => (
                        <span
                          key={i}
                          style={{ width: `${Math.max(12, n / 5)}px` }}
                          className={
                            haptic.visual.playing &&
                            haptic.visual.label === selectedExpression &&
                            Math.floor(haptic.visual.index / 2) === i &&
                            haptic.visual.active
                              ? 'active-pulse'
                              : ''
                          }
                        />
                      ))}
                  </div>
                )}
              </div>
            </div>
            {selectedExpression !== 'neutral' ? (
              <button
                type="button"
                className={`palette-test-haptic ${
                  haptic.visual.playing && haptic.visual.label === selectedExpression
                    ? 'is-playing'
                    : ''
                }`}
                onClick={() => playPattern(selectedExpression)}
              >
                <Waves
                  size={15}
                  className={
                    haptic.visual.playing && haptic.visual.label === selectedExpression
                      ? 'pulse-wave-anim'
                      : ''
                  }
                />
                {haptic.visual.playing && haptic.visual.label === selectedExpression
                  ? 'Đang phát nhịp…'
                  : 'Thử nhịp rung'}
              </button>
            ) : (
              <span className="palette-neutral-pill">Trạng thái nghỉ · Không rung</span>
            )}
          </div>
        )}

        <p className="disclaimer-note">
          Sợ hãi là gợi ý trong hội thoại, không phải cảnh báo nguy hiểm. Trung tính và chưa rõ
          không phát nhịp.
        </p>
        <button className="text-button" onClick={() => go('practice')}>
          Luyện sáu nhịp <ArrowRight size={16} />
        </button>
      </details>
    </>
  );
}
