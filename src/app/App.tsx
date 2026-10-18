import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronRight,
  History,
  Home,
  Leaf,
  LockKeyhole,
  MessageSquare,
  Menu,
  Settings2,
  ShieldCheck,
  Waves,
  X,
} from 'lucide-react';
import {
  defaultSettings,
  MODEL_VERSION,
  type SessionMetrics,
  type Settings,
} from '../shared/contracts';
import type { AuditPage } from '../domain/audit';
import { ActivityLogPage } from '../features/activity/ActivityLogPage';
import { emitAudit, recordPageOpened, setAuditPhase } from '../infrastructure/audit/log';
import { syncReports } from '../infrastructure/backend/reports';
import { loadSettings, saveSettings } from '../infrastructure/storage/database';
import { coreModelsReady, prepareAllModels } from '../infrastructure/offline/prepareAll';
import { packReadiness } from '../infrastructure/offline/packs';
import {
  registerPreparationRunner,
  updatePreparationStatus,
} from '../infrastructure/offline/preparationStatus';
import { TestLab } from '../features/lab/TestLab';
import { Feedback } from '../features/feedback/Feedback';
import type { AuxiliaryArtifact } from '../infrastructure/inference/auxiliary';
import { AdminPage } from '../features/admin/AdminPage';
import { PracticePage } from '../features/practice/PracticePage';
import { HomePage } from '../features/overview/HomePage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { ConversationPage } from '../features/conversation/ConversationPage';
import { HistoryPage } from '../features/history/HistoryPage';
import { useVault } from '../features/history/useVault';
import { SpeechLab } from '../features/lab/SpeechLab';
import {
  ModelInitializationError,
  modelInitializationCode,
  modelInitializationMessage,
  modelInitializationAuditReason,
} from '../domain/modelInitialization';

type Page =
  | 'conversation'
  | 'history'
  | 'home'
  | 'practice'
  | 'feedback'
  | 'settings'
  | 'admin'
  | 'lab'
  | 'speech-lab';
type AppPage = Page | 'activity';
const navigation = [
  { id: 'conversation', name: 'Hội thoại', icon: MessageSquare },
  { id: 'history', name: 'Lịch sử', icon: History },
  { id: 'practice', name: 'Luyện nhịp rung', icon: Waves },
] as const;

export default function App() {
  const [page, setPage] = useState<AppPage>('home');
  const [sessionPrepared, setSessionPrepared] = useState(false);
  const [sessionPreparationFailed, setSessionPreparationFailed] = useState(false);
  const [compatibleFace, setCompatibleFace] = useState(false);
  const [autoFallbackGpu, setAutoFallbackGpu] = useState(true);
  const pageRef = useRef(page);
  pageRef.current = page;
  const activeRef = useRef(false);
  const coreInitialization = useRef<{ ready: boolean; finish: (() => void) | null }>({
    ready: false,
    finish: null,
  });
  const [sessionFailureMessage, setSessionFailureMessage] = useState('');
  const handleUseCompatibleMode = useCallback(() => {
    setCompatibleFace(true);
    setSessionPreparationFailed(false);
    setSessionFailureMessage('');
  }, []);
  const handleRetrySpeedMode = useCallback(() => {
    setAutoFallbackGpu(false);
    setCompatibleFace(false);
    setSessionPreparationFailed(false);
    setSessionFailureMessage('');
  }, []);
  const onPrepared = useCallback(
    (ready: boolean, failed = false, settled = false, failureMessage = '') => {
      coreInitialization.current.ready = ready;
      setSessionPrepared(ready);
      setSessionPreparationFailed(failed);
      setSessionFailureMessage(failureMessage);
      if (ready || failed || settled) coreInitialization.current.finish?.();
    },
    [],
  );
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const sidebar = document.getElementById('main-navigation');
    const buttons = () =>
      Array.from(sidebar?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
    buttons()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        document.querySelector<HTMLButtonElement>('.menu-toggle')?.focus();
      }
      if (event.key === 'Tab') {
        const items = buttons();
        if (event.shiftKey && document.activeElement === items[0]) {
          event.preventDefault();
          items.at(-1)?.focus();
        } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
          event.preventDefault();
          items[0]?.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [menuOpen]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const vaultStore = useVault();
  const [notice, setNotice] = useState('');
  const [offline, setOffline] = useState(false);
  const [coreReady, setCoreReady] = useState(false);
  const [fusionReady, setFusionReady] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [preparationError, setPreparationError] = useState('');
  const [progress, setProgress] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [update, setUpdate] = useState(false);
  const [conversationActive, setConversationActive] = useState(false);
  activeRef.current = conversationActive;
  const [candidate, setCandidate] = useState<AuxiliaryArtifact | null>(null);
  const downloadAbort = useRef<AbortController | null>(null);
  const prepareRunner = useRef<(() => Promise<void>) | null>(null);
  const [downloadDetail, setDownloadDetail] = useState('');
  const notify = useCallback((message: string) => setNotice(message), []);
  const [lastConversationMetrics, setLastConversationMetrics] = useState<SessionMetrics | null>(
    null,
  );
  const [lastConversationModelVersion, setLastConversationModelVersion] = useState(MODEL_VERSION);
  useEffect(() => {
    void loadSettings()
      .then(setSettings)
      .catch(() => notify('Trình duyệt không cho lưu cài đặt.'));
    const network = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) {
        void syncReports();
        if (prepareRunner.current && !activeRef.current) void prepareRunner.current();
      }
    };
    const updated = () => setUpdate(true);
    window.addEventListener('online', network);
    window.addEventListener('offline', network);
    window.addEventListener('signemo-update', updated);
    // registerSW can discover a waiting worker before React subscribes.
    // Reconcile its authoritative state; never activate/reload automatically.
    let updateCheckCancelled = false;
    if (navigator.serviceWorker?.getRegistration)
      void navigator.serviceWorker
        .getRegistration()
        .then((registration) => {
          if (!updateCheckCancelled && registration?.waiting) setUpdate(true);
        })
        .catch(() => {});
    const changedSettings = (event: Event) => {
      const next = (event as CustomEvent<Settings>).detail;
      if (next) setSettings(next);
    };
    window.addEventListener('signemo-settings-change', changedSettings);
    void syncReports();
    emitAudit('assets-preparing', { branch: 'assets' });
    return () => {
      updateCheckCancelled = true;
      window.removeEventListener('online', network);
      window.removeEventListener('offline', network);
      window.removeEventListener('signemo-update', updated);
      window.removeEventListener('signemo-settings-change', changedSettings);
      downloadAbort.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 8000);
    return () => clearTimeout(timer);
  }, [notice]);
  const go = (next: AppPage) => {
    setMenuOpen(false);
    if (next !== page) {
      if (next !== 'home' && next !== 'conversation') coreInitialization.current.finish?.();
      recordPageOpened(next as AuditPage);
      setPage(next);
      window.scrollTo(0, 0);
    }
  };
  const prepare = useCallback(async () => {
    if (downloadAbort.current) return;
    setPreparing(true);
    setProgress(0);
    setPreparationError('');
    updatePreparationStatus({ preparing: true, progress: 0, error: '', detail: '' });
    emitAudit('assets-preparing', { branch: 'assets' });
    setAuditPhase('preparing-assets');
    downloadAbort.current = new AbortController();
    let lastMilestone = -10;
    try {
      const controller = downloadAbort.current;
      const all = await prepareAllModels(
        ({ label, done, total }) => {
          const detail = `${(done / 1048576).toFixed(1)} / ${(total / 1048576).toFixed(1)} MiB · ${label}`;
          // 100% is reserved for verified readiness, not merely downloaded bytes.
          const value = total ? Math.min(99, Math.round((done / total) * 100)) : 0;
          setDownloadDetail(detail);
          setProgress(value);
          updatePreparationStatus({ progress: value, detail });
          const milestone = Math.floor(value / 10) * 10;
          if (milestone >= lastMilestone + 10 && milestone > 0 && milestone < 100) {
            lastMilestone = milestone;
            emitAudit('preparation-progress', { percent: milestone, branch: 'assets' });
          }
        },
        async () => {
          setCoreReady(true);
          setPreparationError('');
          emitAudit('core-assets-ready', { branch: 'speech' });
          updatePreparationStatus({ coreReady: true, error: '' });
          // Sequential core initialization avoids hashing/loading PhoBERT at the
          // same time as ASR/VAD/face allocate their sessions. No device access.
          if (
            !coreInitialization.current.ready &&
            !activeRef.current &&
            (pageRef.current === 'home' || pageRef.current === 'conversation')
          ) {
            await new Promise<void>((resolve) => {
              const finish = () => {
                clearTimeout(timer);
                controller.signal.removeEventListener('abort', finish);
                if (coreInitialization.current.finish === finish)
                  coreInitialization.current.finish = null;
                resolve();
              };
              const timer = setTimeout(finish, 180000);
              coreInitialization.current.finish = finish;
              controller.signal.addEventListener('abort', finish, { once: true });
              if (controller.signal.aborted || coreInitialization.current.ready) finish();
            });
          }
        },
        controller.signal,
      );
      const [core, packs] = await Promise.all([coreModelsReady(), packReadiness()]);
      setCoreReady(core);
      setFusionReady(packs.emotion === true);
      setOffline(all);
      if (all) {
        setProgress(100);
        setDownloadDetail('Đã xác minh và sẵn sàng ngoại tuyến.');
        updatePreparationStatus({ progress: 100, detail: 'Đã xác minh và sẵn sàng ngoại tuyến.' });
      }
      if (all) emitAudit('offline-ready', { branch: 'assets' });
      setPreparationError('');
      updatePreparationStatus({
        coreReady: core,
        fusionReady: packs.emotion === true,
        offline: all,
        error: '',
      });
    } catch (err) {
      setProgress((current) => Math.min(current, 99));
      setOffline(false);
      const failure =
        err instanceof ModelInitializationError || modelInitializationCode(err) !== 'worker'
          ? modelInitializationMessage('assets', modelInitializationCode(err))
          : err instanceof DOMException && err.name === 'QuotaExceededError'
            ? 'Không đủ dung lượng trình duyệt. Giải phóng bộ nhớ rồi thử lại.'
            : err instanceof Error
              ? err.message
              : 'Chưa chuẩn bị được tài nguyên trên thiết bị.';
      setPreparationError(failure);
      emitAudit('preparation-failed', {
        reason: modelInitializationAuditReason(modelInitializationCode(err)),
        branch:
          err instanceof DOMException && err.name === 'QuotaExceededError' ? 'storage' : 'assets',
      });
      updatePreparationStatus({ offline: false, error: failure });
      void coreModelsReady()
        .then(async (core) => {
          const packs = await packReadiness();
          setCoreReady(core);
          setFusionReady(packs.emotion === true);
          if (core) emitAudit('core-assets-ready', { branch: 'speech' });
          updatePreparationStatus({ coreReady: core });
        })
        .catch(() => {
          setCoreReady(false);
          updatePreparationStatus({ coreReady: false });
        });
    } finally {
      downloadAbort.current = null;
      setPreparing(false);
      updatePreparationStatus({ preparing: false });
    }
  }, []);
  const prepareStarted = useRef(false);
  useEffect(() => {
    if (prepareStarted.current) return;
    prepareStarted.current = true;
    void prepare();
  }, [prepare]);
  useEffect(() => {
    prepareRunner.current = prepare;
    const unregister = registerPreparationRunner(() => void prepare());
    return () => {
      prepareRunner.current = null;
      unregister();
    };
  }, [prepare]);
  const changeSettings = (next: Settings) => {
    if (next.captionColors !== settings.captionColors)
      emitAudit('caption-colors-changed', { enabled: next.captionColors !== false });
    if (next.expressionAvatar !== settings.expressionAvatar)
      emitAudit('avatar-changed', { enabled: next.expressionAvatar === true });
    setSettings(next);
    void saveSettings(next).catch(() => notify('Chưa lưu được cài đặt trên thiết bị.'));
  };

  return (
    <div
      className={`app-shell ${menuOpen ? 'menu-open' : ''}`}
      data-build={import.meta.env.VITE_BUILD_ID || 'development'}
    >
      <a className="skip-link" href="#main">
        Đến nội dung chính
      </a>
      <aside id="main-navigation" className="sidebar" aria-label="Điều hướng chính">
        <button className="brand" onClick={() => go('home')} aria-label="SignEmo, về tổng quan">
          <span className="brand-icon">
            <Waves size={22} />
          </span>
          <span>
            Sign<span className="brand-em">Emo</span>
            <sup>●</sup>
          </span>
        </button>
        <div className="workspace-label">KHÔNG GIAN CỦA BẠN</div>
        <nav>
          {navigation.map((item) => (
            <button
              key={item.id}
              aria-current={page === item.id ? 'page' : undefined}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => go(item.id)}
            >
              <item.icon size={20} />
              <span>{item.name}</span>
              {page === item.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <nav className="secondary-navigation">
          <button className="nav-item" onClick={() => go('home')}>
            <Home size={20} />
            <span>Giới thiệu</span>
          </button>
          <button className="nav-item" onClick={() => go('feedback')}>
            <MessageSquare size={20} />
            <span>Phản hồi của bạn</span>
          </button>
          <button className="nav-item" onClick={() => go('settings')}>
            <Settings2 size={20} />
            <span>Cài đặt</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note">
            <ShieldCheck size={23} />
            <strong>Riêng tư từ thiết kế</strong>
            <p>Hình ảnh và lời nói được xử lý ngay trên thiết bị của bạn.</p>
            <span>
              <span className="tiny-dot" /> Không tải media hay phụ đề lên máy chủ
            </span>
          </div>
          <button
            className={`nav-item admin-link ${page === 'admin' ? 'active' : ''}`}
            onClick={() => go('admin')}
          >
            <LockKeyhole size={17} />
            Quản trị pilot
          </button>
          <div className="version">
            SIGNEMO{' '}
            {new URLSearchParams(location.search).has('diagnostics') && (
              <span>{import.meta.env.VITE_BUILD_ID || 'development'}</span>
            )}
          </div>
        </div>
      </aside>
      {menuOpen && (
        <button
          className="navigation-backdrop"
          aria-label="Đóng điều hướng"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <div className="content-shell">
        <header className="topbar">
          <button
            className="menu-toggle"
            aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={menuOpen}
            aria-controls="main-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="breadcrumb">
            SignEmo <ChevronRight size={14} />
            <strong>
              {navigation.find((n) => n.id === page)?.name ??
                (
                  {
                    home: 'Giới thiệu',
                    feedback: 'Phản hồi',
                    settings: 'Cài đặt',
                    admin: 'Quản trị pilot',
                    lab: 'Phòng kiểm thử',
                    'speech-lab': 'Kiểm thử tiếng nói',
                    activity: 'Nhật ký hoạt động',
                  } as Record<string, string>
                )[page]}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="edge-badge">
              <Leaf size={14} /> Trên thiết bị
            </span>
            <button
              className="mobile-settings"
              aria-label="Mở cài đặt"
              onClick={() => go('settings')}
            >
              <Settings2 size={20} />
            </button>
            <span className="connection">
              <span className={`tiny-dot ${online ? '' : 'muted'}`} />
              {online ? 'Đang kết nối' : 'Ngoại tuyến'}
            </span>
          </div>
        </header>
        <main
          id="main"
          className={page === 'conversation' ? 'conversation-workspace' : undefined}
          tabIndex={-1}
        >
          {update && (
            <div className="banner">
              Có phiên bản mới. Kết thúc phiên trước khi cập nhật.
              <button
                className="button secondary"
                disabled={conversationActive || page === 'lab' || page === 'speech-lab'}
                onClick={async () => {
                  const registration = await navigator.serviceWorker.getRegistration();
                  if (!registration?.waiting) {
                    window.location.reload();
                    return;
                  }
                  navigator.serviceWorker.addEventListener(
                    'controllerchange',
                    () => window.location.reload(),
                    { once: true },
                  );
                  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                }}
              >
                Cập nhật và tải lại
              </button>
            </div>
          )}
          {(page === 'conversation' || page === 'home') && (
            <div hidden={page === 'home'}>
              <ConversationPage
                visible={page === 'conversation'}
                onPrepared={onPrepared}
                settings={settings}
                changeSettings={changeSettings}
                store={vaultStore}
                candidate={candidate}
                openHistory={() => go('history')}
                openSettings={() => go('settings')}
                onActive={setConversationActive}
                onMetrics={(metrics, modelVersion) => {
                  setLastConversationMetrics(metrics);
                  setLastConversationModelVersion(modelVersion);
                }}
                onToggleSound={() =>
                  changeSettings({ ...settings, soundFeedback: !settings.soundFeedback })
                }
                compatibleFace={compatibleFace}
                onCompatibleFaceChange={setCompatibleFace}
                autoFallbackGpu={autoFallbackGpu}
              />
            </div>
          )}
          {page === 'history' && <HistoryPage store={vaultStore} />}
          {page === 'speech-lab' && <SpeechLab />}
          {page === 'home' && (
            <HomePage
              go={go}
              aiReady={sessionPrepared}
              aiFailed={sessionPreparationFailed}
              aiFailureMessage={sessionFailureMessage}
              isGpuFailure={sessionFailureMessage.includes('tăng tốc')}
              compatibleMode={compatibleFace}
              onUseCompatibleMode={handleUseCompatibleMode}
              onRetrySpeedMode={handleRetrySpeedMode}
              prepare={prepare}
              offline={offline}
              preparing={preparing}
              progress={progress}
            />
          )}
          {page === 'practice' && (
            <PracticePage
              onNotice={notify}
              mode={settings.hapticMode ?? (settings.haptics ? 'auto' : 'off')}
            />
          )}
          {page === 'feedback' && (
            <Feedback
              metrics={lastConversationMetrics}
              modelVersion={lastConversationModelVersion}
              onNotice={notify}
            />
          )}
          {page === 'settings' && (
            <SettingsPage
              settings={settings}
              changeSettings={changeSettings}
              prepare={prepare}
              preparing={preparing}
              progress={progress}
              offline={offline}
              go={go}
            />
          )}
          {page === 'activity' && <ActivityLogPage />}
          {page === 'lab' && (
            <TestLab settings={settings} onNotice={notify} onCandidate={setCandidate} />
          )}
          {page === 'admin' && <AdminPage onNotice={notify} />}
          {(preparing || preparationError) && page !== 'conversation' && page !== 'home' && (
            <section className="offline-status" aria-live="polite">
              {preparing && (
                <>
                  <progress max={100} value={progress} aria-label="Tiến độ tải ngoại tuyến" />
                  <span>{downloadDetail}</span>
                </>
              )}
              <small>{preparationError || 'Đang chuẩn bị SignEmo trên thiết bị…'}</small>
              {preparationError && (
                <button className="text-button" onClick={() => void prepare()}>
                  Thử tải lại model
                </button>
              )}
            </section>
          )}
          <footer className="page-footer">
            <span>SignEmo · Cầu nối qua từng biểu cảm</span>
            <span>
              <ShieldCheck size={13} /> Thiết kế cùng sự tôn trọng
            </span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button aria-label="Đóng thông báo" onClick={() => setNotice('')}>
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
