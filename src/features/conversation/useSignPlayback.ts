import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ConversationRecord } from '../../domain/conversation';
import { signUtterances, type SignPhraseItem } from '../../domain/signPhrases';
import { SignPlaybackQueue, type SignRequest } from '../../domain/sign/signPlayback';

export function useSignPlayback(
  record: ConversationRecord | null,
  enabled: boolean,
  active: boolean,
  catalogue: readonly SignPhraseItem[],
) {
  const queue = useRef(new SignPlaybackQueue());
  const session = useRef<string | undefined>(undefined);
  const lastAutoId = useRef<string | undefined>(undefined);
  const manual = useRef(0);
  const [manualSelection, setManualSelection] = useState<SignRequest | null>(null);
  const [autoSelection, setAutoSelection] = useState<SignRequest | null>(null);
  const utterances = useMemo(() => signUtterances(record?.segments ?? []), [record]);

  useEffect(() => {
    if (session.current !== record?.id) {
      queue.current.clear();
      lastAutoId.current = undefined;
      setManualSelection(null);
      setAutoSelection(null);
      session.current = record?.id;
    }
    if (!enabled || !active || document.hidden) {
      // Consume old finals without playing them: enabling later must not replay history.
      queue.current.update(utterances, []);
      queue.current.dismiss();
      lastAutoId.current = undefined;
      setAutoSelection(null);
      if (!enabled) setManualSelection(null);
      return;
    }
    queue.current.update(utterances, catalogue);
    const nextAuto = queue.current.current;
    if (nextAuto && nextAuto.id !== lastAutoId.current) {
      lastAutoId.current = nextAuto.id;
      // Newly spoken live utterance takes priority over an older manual preview
      setManualSelection(null);
    }
    setAutoSelection(nextAuto);
  }, [record?.id, utterances, catalogue, enabled, active]);

  const clear = useCallback(() => {
    setManualSelection(null);
    queue.current.dismiss();
    setAutoSelection(null);
  }, []);

  useEffect(() => {
    const hide = () => {
      if (document.hidden) clear();
    };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', clear);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', clear);
    };
  }, [clear]);

  const end = useCallback(() => {
    if (!manualSelection) {
      queue.current.finish();
      if (queue.current.current) setAutoSelection(queue.current.current);
    }
  }, [manualSelection]);

  const select = useCallback((phrase: SignPhraseItem) => {
    const request: SignRequest = {
      id: `manual-${phrase.id}-${++manual.current}`,
      text: phrase.text,
      phrase,
    };
    setManualSelection(request);
  }, []);

  const selection = manualSelection ?? autoSelection;

  return { selection, utterances, select, end, clear };
}
