import { useCallback, useEffect, useRef, useState } from 'react';
import { ConversationVault } from '../../infrastructure/storage/vault';
import { emitAudit } from '../../infrastructure/audit/log';
import {
  ConversationPersistence,
  type SaveState,
} from '../../infrastructure/storage/conversationPersistence';
export function useVault() {
  const [vault] = useState(() => new ConversationVault());
  const [persistence] = useState(() => new ConversationPersistence(vault));
  const [saveState, setSaveState] = useState<SaveState>('off');
  const [revision, setRevision] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const refresh = useCallback(() => {
    setRevision((v) => v + 1);
    persistence.sync();
    if (vault.unlocked) void persistence.retry();
  }, [vault, persistence]);
  useEffect(
    () =>
      persistence.subscribe(() => {
        setSaveState(persistence.state);
      }),
    [persistence],
  );
  const lock = useCallback(() => {
    const wasUnlocked = vault.unlocked;
    vault.lock();
    if (wasUnlocked) emitAudit('vault-locked', { branch: 'storage' });
    refresh();
  }, [vault, refresh]);
  useEffect(() => {
    const activity = () => {
      clearTimeout(timer.current);
      if (vault.unlocked) timer.current = setTimeout(lock, 300_000);
    };
    const hide = () => {
      if (document.hidden) lock();
    };
    document.addEventListener('pointerdown', activity);
    document.addEventListener('keydown', activity);
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', lock);
    void vault.prune().catch(() => {});
    activity();
    return () => {
      clearTimeout(timer.current);
      document.removeEventListener('pointerdown', activity);
      document.removeEventListener('keydown', activity);
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', lock);
      vault.lock();
      persistence.clear();
    };
  }, [vault, lock]);
  useEffect(() => {
    clearTimeout(timer.current);
    if (vault.unlocked) timer.current = setTimeout(lock, 300_000);
  }, [revision, vault, lock]);
  return { vault, revision, refresh, lock, persistence, saveState };
}
