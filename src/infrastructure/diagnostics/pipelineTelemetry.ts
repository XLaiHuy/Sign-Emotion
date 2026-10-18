import { numericPipelineMetric, type PipelineMetric } from '../../domain/pipelineMetrics';

/** Ephemeral, explicitly enabled local benchmark channel. Never persisted or sent to a server. */
export function emitPipelineMetric(metric: PipelineMetric) {
  if (
    typeof window === 'undefined' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) ||
    new URLSearchParams(window.location.search).get('benchmark') !== '1'
  )
    return;
  const detail = numericPipelineMetric(metric);
  if (detail) window.dispatchEvent(new CustomEvent('signemo:pipeline-metric', { detail }));
}
