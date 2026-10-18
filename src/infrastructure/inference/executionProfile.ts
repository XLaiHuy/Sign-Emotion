/** Research controls are local URL opt-ins; never persisted as user settings. */
export function detectorDelegate(): 'CPU' | 'GPU' {
  if (import.meta.env.VITE_STREAMING_ASR !== 'moonshine' || typeof location === 'undefined')
    return 'CPU';
  return ['127.0.0.1', 'localhost'].includes(location.hostname) &&
    new URLSearchParams(location.search).get('detector') === 'gpu'
    ? 'GPU'
    : 'CPU';
}
