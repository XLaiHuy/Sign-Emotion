/** Map a rendered audio frame into the document clock; do not assume the two clocks run equally. */
export function audioFrameStartMs(
  contextEndSeconds: number,
  stamp: { contextTime?: number; performanceTime?: number },
  samples: number,
) {
  if (
    !Number.isFinite(contextEndSeconds) ||
    contextEndSeconds < 0 ||
    !Number.isFinite(stamp.contextTime) ||
    !Number.isFinite(stamp.performanceTime) ||
    (stamp.contextTime ?? -1) < 0 ||
    (stamp.performanceTime ?? 0) <= 0 ||
    !Number.isInteger(samples) ||
    samples <= 0
  )
    return undefined;
  return stamp.performanceTime! + (contextEndSeconds - stamp.contextTime!) * 1000 - samples / 16;
}

/** Continuity belongs to rendered PCM time, not a potentially jittering output clock pair. */
export function audioFrameGapMs(
  currentEndSeconds: number,
  previousEndSeconds: number | undefined,
  samples: number,
) {
  if (previousEndSeconds === undefined) return 0;
  if (
    ![currentEndSeconds, previousEndSeconds].every(Number.isFinite) ||
    samples <= 0 ||
    currentEndSeconds < previousEndSeconds
  )
    return Infinity;
  return Math.max(0, (currentEndSeconds - previousEndSeconds) * 1000 - samples / 16);
}
