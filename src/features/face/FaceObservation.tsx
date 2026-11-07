import { useEffect, useRef, useState } from 'react';
import type { InferenceResult } from '../../shared/contracts';
import { ObservationCounts, observationReason } from '../../domain/face/observation';
import { Diagnostics, resultExplanation } from './Diagnostics';

/** Display-only diagnostics. Never feeds the prediction or haptic gate. */
export function FaceObservation({ result, active }: { result: InferenceResult; active: boolean }) {
  const latest = useRef(result);
  const counts = useRef(new ObservationCounts());
  const pending = useRef('');
  const snapshotTimer = useRef<number | undefined>(undefined);
  const hintTimer = useRef<number | undefined>(undefined);
  const [snapshot, setSnapshot] = useState(result);
  const [hint, setHint] = useState('Đang chờ quan sát khuôn mặt');
  useEffect(() => {
    counts.current = new ObservationCounts();
    pending.current = '';
    setHint('Đang chờ quan sát khuôn mặt');
    return () => {
      window.clearTimeout(snapshotTimer.current);
      window.clearTimeout(hintTimer.current);
      snapshotTimer.current = undefined;
      hintTimer.current = undefined;
    };
  }, [active]);
  useEffect(() => {
    latest.current = result;
    if (!active) return;
    counts.current.add(result);
    const reason = observationReason(result);
    if (reason !== pending.current) {
      pending.current = reason;
      window.clearTimeout(hintTimer.current);
      if (reason === 'observed') setHint('Đang quan sát biểu cảm');
      else
        hintTimer.current = window.setTimeout(
          () => setHint(resultExplanation(latest.current)),
          700,
        );
    }
    if (snapshotTimer.current === undefined)
      snapshotTimer.current = window.setTimeout(() => {
        setSnapshot(latest.current);
        snapshotTimer.current = undefined;
      }, 250);
  }, [result, active]);
  if (!active) return null;
  const isObserving = hint === 'Đang quan sát biểu cảm';
  return (
    <div className="face-observation">
      <p
        className={`face-observation-pill${isObserving ? ' face-observation-active' : ''}`}
        role="status"
        aria-live="polite"
      >
        <span className="face-observation-dot" aria-hidden="true" />
        <span>{hint}</span>
      </p>
      <Diagnostics result={snapshot} counts={counts.current} />
    </div>
  );
}
