import { useEffect, useState } from 'react';
import { ArrowRight, Play, Volume2, VolumeX, Waves } from 'lucide-react';
import { expressionUI, expressions, type Expression } from '../../shared/contracts';
import { loadSettings, saveSettings } from '../../infrastructure/storage/database';
import { useHaptics } from './useHaptics';
import { HapticDisplay } from './HapticDisplay';
import { PageTitle } from '../../shared/ui/PageTitle';

export function PracticePage({
  onNotice,
  mode,
}: {
  onNotice: (v: string) => void;
  mode: 'auto' | 'visual' | 'off';
}) {
  const labels: Exclude<Expression, 'neutral'>[] = [
    'happy',
    'sad',
    'angry',
    'surprised',
    'fear',
    'disgust',
  ];
  const [quiz, setQuiz] = useState<Expression[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answer, setAnswer] = useState<Expression | null>(null);
  const [played, setPlayed] = useState(false);
  const [soundFeedback, setSoundFeedback] = useState(true);
  useEffect(() => {
    let active = true;
    void loadSettings()
      .then((settings) => {
        if (active) setSoundFeedback(settings.soundFeedback);
      })
      .catch(() => onNotice('Chưa đọc được cài đặt âm báo trên thiết bị.'));
    return () => {
      active = false;
    };
  }, [onNotice]);
  const haptic = useHaptics(mode, soundFeedback);
  const clear = haptic.cancel;
  const play = async (label: Expression) => {
    const event = await haptic.playFromGesture(label, 'practice');
    if (!event) onNotice('Nhịp đang tắt. Bật chế độ tự động trong Cài đặt.');
    setPlayed(Boolean(event));
  };
  const toggleSound = async () => {
    try {
      const current = await loadSettings();
      const next = { ...current, soundFeedback: !soundFeedback };
      setSoundFeedback(next.soundFeedback);
      await saveSettings(next);
      window.dispatchEvent(new CustomEvent('signemo-settings-change', { detail: next }));
    } catch {
      onNotice('Chưa lưu được cài đặt âm báo.');
    }
  };
  const begin = () => {
    clear();
    const deck = [...labels, ...labels];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    setQuiz(deck);
    setIndex(0);
    setScore(0);
    setAnswer(null);
    setPlayed(false);
  };
  return (
    <>
      <PageTitle
        eyebrow="LÀM QUEN BẰNG XÚC GIÁC"
        title="Mỗi nhịp, một gợi ý"
        subtitle="Trên máy tính phát âm báo; thiết bị hỗ trợ có thể rung."
      />
      <div className="practice-action-toolbar">
        <button className="button secondary sound-toggle" onClick={() => void toggleSound()}>
          {soundFeedback ? <Volume2 size={17} /> : <VolumeX size={17} />}
          Âm báo {soundFeedback ? 'bật' : 'tắt'}
        </button>
        <button className="button secondary test-sound-btn" onClick={() => void haptic.testSound()}>
          Thử âm
        </button>
      </div>
      {haptic.audioState !== 'ready' && (
        <p className="fine-note" role="status">
          Bấm “Thử âm” để kiểm tra loa. Nhịp vẫn hiển thị bằng hình ảnh.
        </p>
      )}
      <div className="practice-grid">
        {labels.map((label) => (
          <section className={`card practice-card expression-${label}`} key={label}>
            <span className="expression-emoji">{expressionUI[label].icon}</span>
            <h2>{expressionUI[label].name}</h2>
            <p>{expressionUI[label].short}</p>
            <div className="wave-diagram" aria-label={expressionUI[label].short}>
              {expressionUI[label].pattern
                .filter((_, i) => i % 2 === 0)
                .map((n, i) => (
                  <span
                    key={i}
                    style={{ width: `${Math.max(12, n / 5)}px` }}
                    className={
                      haptic.visual.playing &&
                      haptic.visual.label === label &&
                      Math.floor(haptic.visual.index / 2) === i &&
                      haptic.visual.active
                        ? 'active-pulse'
                        : ''
                    }
                  />
                ))}
            </div>
            <button className="button secondary" onClick={() => play(label)}>
              <Waves size={17} />
              Thử nhịp
            </button>
          </section>
        ))}
      </div>
      <section className="card quiz-card">
        <div className="quiz-header">
          <span className="eyebrow">THỬ NHỚ NHỊP RUNG</span>
          <h2>Bạn nhận ra nhịp nào?</h2>
          <p>8 lượt ngẫu nhiên để làm quen. Không phải bài đánh giá khả năng giao tiếp.</p>
        </div>
        <HapticDisplay visual={haptic.visual} />
        {!quiz.length ? (
          <div className="quiz-start-box">
            <button className="button primary quiz-start-btn" onClick={begin}>
              Bắt đầu luyện tập <ArrowRight size={17} />
            </button>
          </div>
        ) : index >= quiz.length ? (
          <div className="quiz-complete">
            <h3>Hoàn thành {score}/8 lượt</h3>
            <p>
              {score >= 6
                ? 'Bạn đã làm quen rất tốt với các nhịp. Hãy thử trong một cuộc trò chuyện thực tế.'
                : 'Bạn có thể thử lại từng nhịp ở phía trên theo nhịp độ thoải mái nhất của mình.'}
            </p>
            <button className="button secondary" onClick={begin}>
              Luyện lại
            </button>
          </div>
        ) : (
          <div className="quiz-body">
            <div className="quiz-progress-bar">
              <span className="quiz-turn-counter">Lượt {index + 1}/8</span>
              <div className="quiz-dots" aria-hidden="true">
                {quiz.slice(0, 8).map((_, i) => (
                  <span
                    key={i}
                    className={`quiz-dot ${i < index ? 'done' : i === index ? 'current' : ''}`}
                  />
                ))}
              </div>
            </div>

            <div className="quiz-stage-action">
              <button
                className={`button primary quiz-play-pulse-btn ${haptic.visual.playing ? 'is-playing' : ''}`}
                onClick={() => play(quiz[index])}
              >
                <Play size={16} />
                {haptic.visual.playing ? 'Đang phát nhịp…' : 'Phát nhịp'}
              </button>
              <span className="quiz-hint-text">
                {!played
                  ? 'Bấm “Phát nhịp” trước khi chọn đáp án.'
                  : 'Cảm nhận và chọn sắc thái tương ứng:'}
              </span>
            </div>

            <div className="quiz-options">
              {labels.map((label) => {
                const isChosen = answer === label;
                const isCorrect = answer && label === quiz[index];
                const isWrong = isChosen && label !== quiz[index];
                return (
                  <button
                    className={`button secondary quiz-choice-btn ${isChosen ? 'selected' : ''} ${
                      isCorrect ? 'is-correct' : ''
                    } ${isWrong ? 'is-wrong' : ''}`}
                    disabled={!played || Boolean(answer)}
                    key={label}
                    onClick={() => {
                      setAnswer(label);
                      if (label === quiz[index]) setScore((v) => v + 1);
                    }}
                  >
                    <span className="quiz-choice-emoji" aria-hidden="true">
                      {expressionUI[label].icon}
                    </span>
                    <span className="quiz-choice-text">{expressionUI[label].name}</span>
                  </button>
                );
              })}
            </div>
            {answer && (
              <div
                className={`quiz-feedback-box ${answer === quiz[index] ? 'correct' : 'hint'}`}
                aria-live="polite"
              >
                <p>
                  {answer === quiz[index]
                    ? 'Đúng rồi!'
                    : 'Nhịp vừa rồi là: ' + expressionUI[quiz[index]].name}
                </p>
                <button
                  className="button secondary quiz-next-btn"
                  onClick={() => {
                    clear();
                    setIndex((v) => v + 1);
                    setAnswer(null);
                    setPlayed(false);
                  }}
                >
                  Tiếp tục <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </section>
      <div className="callout">
        <VolumeX size={21} />
        <p>
          Biểu cảm trung tính và kết quả chưa rõ không phát rung. Bạn có thể tắt rung bất cứ lúc nào
          trong Cài đặt.
        </p>
      </div>
    </>
  );
}
