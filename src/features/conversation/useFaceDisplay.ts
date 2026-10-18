import { useEffect, useRef, useState } from 'react';
import type { Expression, InferenceResult } from '../../shared/contracts';

/** Visual continuity only. Never passed to FaceWindow, fusion or rhythm gates. */
export function useFaceDisplay(result: InferenceResult, enabled: boolean) {
  const previous = useRef<Expression | null>(null);
  const missingSince = useRef<number | null>(null);
  const [held, setHeld] = useState<Expression | null>(null);
  useEffect(() => {
    if (enabled && result.status === 'valid' && result.label) {
      previous.current = result.label;
      missingSince.current = null;
      setHeld(null);
      return;
    }
    if (!enabled || result.status !== 'no-face' || result.decisionReason === 'stale-result') {
      previous.current = null;
      missingSince.current = null;
      setHeld(null);
      return;
    }
    missingSince.current ??= performance.now();
    const remaining = 150 - (performance.now() - missingSince.current);
    if (!previous.current || remaining <= 0) {
      setHeld(null);
      return;
    }
    setHeld(previous.current);
    const timer = setTimeout(() => {
      previous.current = null;
      setHeld(null);
    }, remaining);
    return () => clearTimeout(timer);
  }, [enabled, result]);
  const current = enabled && result.status === 'valid' ? result.label : null;
  const carrying = enabled && result.status === 'no-face' && !!held;
  return { label: current ?? (carrying ? held : null), carrying };
}
