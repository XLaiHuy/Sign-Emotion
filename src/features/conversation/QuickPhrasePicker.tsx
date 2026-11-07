import { useState, useMemo, useEffect, useRef, memo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Sparkles,
  MessageSquare,
  HeartPulse,
  Coffee,
  Search,
  X,
} from 'lucide-react';
import {
  signPhrases100Catalogue,
  type SignPhraseItem,
} from '../../domain/sign/signPhrasesCatalogue';

export interface QuickPhrasePickerProps {
  onSelectPhrase: (text: string) => void;
  available?: readonly SignPhraseItem[];
  activePhraseId?: string;
  activeSelectionKey?: string;
  activePhraseText?: string;
}

const FEATURED_SCENARIO_IDS = ['SENT001', 'SENT003', 'SENT064', 'SENT020', 'SENT098'] as const;

export const QuickPhrasePicker = memo(function QuickPhrasePicker({
  onSelectPhrase,
  available = [],
  activePhraseId,
  activeSelectionKey,
  activePhraseText,
}: QuickPhrasePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'communication' | 'health' | 'daily'>(
    'communication',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const prevSelectionKey = useRef<string | undefined>(activeSelectionKey);

  // Auto-close the 100-phrase overlay whenever a new spoken or clicked sign starts playing
  // so the VSL video stage underneath is never occluded.
  useEffect(() => {
    if (activeSelectionKey && activeSelectionKey !== prevSelectionKey.current) {
      setIsOpen(false);
    }
    prevSelectionKey.current = activeSelectionKey;
  }, [activeSelectionKey]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const featuredPhrases = useMemo(
    () =>
      FEATURED_SCENARIO_IDS.map((id) =>
        signPhrases100Catalogue.find((item) => item.id === id),
      ).filter((item): item is SignPhraseItem => Boolean(item)),
    [],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return signPhrases100Catalogue.filter((item) => {
      const tabMatch = activeTab === 'all' ? true : item.category === activeTab;
      if (!tabMatch) return false;
      if (!q) return true;
      return (
        item.text.toLowerCase().includes(q) ||
        (item.signClass && item.signClass.toLowerCase().includes(q))
      );
    });
  }, [activeTab, searchQuery]);

  return (
    <div className="quick-phrase-picker">
      {!isOpen && featuredPhrases.length > 0 && (
        <div className="quick-scenario-strip" aria-label="Câu mẫu thử nhanh">
          <small className="quick-scenario-label">Thử nhanh mẫu câu ký hiệu:</small>
          <div className="quick-scenario-chips">
            {featuredPhrases.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`quick-scenario-chip${activePhraseId === item.id ? ' active' : ''}`}
                onClick={() => onSelectPhrase(item.text)}
              >
                {item.text}
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        className="quick-phrase-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <Sparkles size={16} />
        <span>Khám phá 100 mẫu câu ký hiệu ({available.length} mẫu sẵn sàng)</span>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isOpen && (
        <div className="quick-phrase-content">
          <div
            className="quick-phrase-overlay-header"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#cbd5e1' }}>
              {activePhraseText
                ? `Đang có video ký hiệu: “${activePhraseText}”`
                : 'Chọn mẫu câu để chiếu video ký hiệu'}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                borderRadius: '8px',
                border: '1px solid rgba(52, 211, 153, 0.45)',
                background: 'rgba(16, 185, 129, 0.16)',
                color: '#34d399',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
              }}
              aria-label="Đóng danh mục mẫu câu"
            >
              <X size={14} />
              <span>{activePhraseText ? 'Xem video ký hiệu' : 'Thu gọn'}</span>
            </button>
          </div>
          <div
            className="quick-phrase-search-bar"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
              position: 'relative',
            }}
          >
            <Search
              size={16}
              style={{ position: 'absolute', left: 10, color: 'var(--text-secondary, #94a3b8)' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm nhanh mẫu câu hoặc từ khóa (ví dụ: cảm ơn, sốt, bác sĩ...)"
              className="quick-phrase-search-input"
              style={{
                width: '100%',
                padding: '8px 32px 8px 34px',
                borderRadius: '8px',
                border: '1px solid rgba(51, 65, 85, 0.85)',
                background: 'rgba(15, 23, 42, 0.92)',
                color: '#f8fafc',
                fontSize: '13px',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                }}
                aria-label="Xóa tìm kiếm"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="quick-phrase-tabs" role="tablist">
            <button
              type="button"
              className={`quick-phrase-tab${activeTab === 'communication' ? ' active' : ''}`}
              onClick={() => setActiveTab('communication')}
            >
              <MessageSquare size={14} /> Giao tiếp (
              {signPhrases100Catalogue.filter((i) => i.category === 'communication').length})
            </button>
            <button
              type="button"
              className={`quick-phrase-tab${activeTab === 'health' ? ' active' : ''}`}
              onClick={() => setActiveTab('health')}
            >
              <HeartPulse size={14} /> Y tế & Sức khỏe (
              {signPhrases100Catalogue.filter((i) => i.category === 'health').length})
            </button>
            <button
              type="button"
              className={`quick-phrase-tab${activeTab === 'daily' ? ' active' : ''}`}
              onClick={() => setActiveTab('daily')}
            >
              <Coffee size={14} /> Đời sống hàng ngày (
              {signPhrases100Catalogue.filter((i) => i.category === 'daily').length})
            </button>
            <button
              type="button"
              className={`quick-phrase-tab${activeTab === 'all' ? ' active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              Tất cả (100)
            </button>
          </div>

          <div className="quick-phrase-list" role="list">
            {filtered.length === 0 ? (
              <p
                style={{
                  padding: '16px',
                  textAlign: 'center',
                  color: 'var(--text-secondary, #777)',
                  fontSize: '13px',
                  width: '100%',
                }}
              >
                Không tìm thấy mẫu câu nào khớp với &quot;{searchQuery}&quot;.
              </p>
            ) : (
              filtered.map((item: SignPhraseItem) => (
                <button
                  key={item.id}
                  type="button"
                  className="quick-phrase-chip"
                  onClick={() => {
                    onSelectPhrase(item.text);
                    setIsOpen(false);
                  }}
                  title={
                    available.some((p) => p.id === item.id)
                      ? 'Xem video mẫu ký hiệu'
                      : 'Chưa có mẫu ký hiệu'
                  }
                >
                  <span className="chip-text">{item.text}</span>
                  {item.signClass && (
                    <small style={{ opacity: 0.7, marginLeft: 4 }}>· {item.signClass}</small>
                  )}
                </button>
              ))
            )}
          </div>
          <small className="quick-phrase-tip">
            Đã tích hợp đầy đủ 100/100 video cử chỉ ký hiệu người thật từ bộ dữ liệu VSL. Bấm vào
            câu để xem ngay video minh họa cử chỉ.
          </small>
        </div>
      )}
    </div>
  );
});
