import { useState, useMemo, memo } from 'react';
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
}

export const QuickPhrasePicker = memo(function QuickPhrasePicker({
  onSelectPhrase,
  available = [],
}: QuickPhrasePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'communication' | 'health' | 'daily'>(
    'communication',
  );
  const [searchQuery, setSearchQuery] = useState('');

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
              style={{ position: 'absolute', left: 10, color: 'var(--text-secondary, #666)' }}
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
                border: '1px solid var(--border-color, #e0e0e0)',
                background: 'var(--bg-input, #fff)',
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
                  onClick={() => onSelectPhrase(item.text)}
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
