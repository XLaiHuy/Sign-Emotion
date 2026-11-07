import { useEffect, useRef, useState } from 'react';
import { faceScoreLabels, type Expression, type InferenceResult } from '../../shared/contracts';

export const HOLD_MS_VALID = 150;
export const HOLD_MS_UNCERTAIN = 350;

/** Visual continuity only. Never passed to FaceWindow, fusion or rhythm gates. */
export function useFaceDisplay(
  result: InferenceResult,
  enabled: boolean,
  holdMsValid = HOLD_MS_VALID,
  holdMsUncertain = HOLD_MS_UNCERTAIN,
) {
  const previous = useRef<Expression | null>(null);
  const missingSince = useRef<number | null>(null);
  const [held, setHeld] = useState<Expression | null>(null);

  // If the stabilizing frame shows evidence of transitioning to a different expression,
  // do not stick to the stale previous expression.
  const leadingExpression =
    result.scores && result.scores.length === faceScoreLabels.length
      ? faceScoreLabels[result.scores.indexOf(Math.max(...result.scores))]
      : null;
  const isTransitioningToOther =
    result.status === 'uncertain' &&
    result.decisionReason === 'stabilizing' &&
    leadingExpression !== null &&
    previous.current !== null &&
    leadingExpression !== previous.current;

  const carryable =
    !isTransitioningToOther &&
    (result.status === 'no-face' ||
      (result.status === 'uncertain' && result.decisionReason === 'stabilizing'));
  const holdMs = result.status === 'uncertain' ? holdMsUncertain : holdMsValid;
  useEffect(() => {
    if (enabled && result.status === 'valid' && result.label) {
      previous.current = result.label;
      missingSince.current = null;
      setHeld(null);
      return;
    }
    if (!enabled || !carryable || result.decisionReason === 'stale-result') {
      previous.current = null;
      missingSince.current = null;
      setHeld(null);
      return;
    }
    missingSince.current ??= performance.now();
    const remaining = holdMs - (performance.now() - missingSince.current);
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
  }, [enabled, result, carryable, holdMs]);
  const current = enabled && result.status === 'valid' ? result.label : null;
  const carrying = enabled && carryable && !!held;
  return { label: current ?? (carrying ? held : null), carrying };
}
