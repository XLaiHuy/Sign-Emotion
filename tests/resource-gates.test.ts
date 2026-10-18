import { expect, it } from 'vitest';
import { resourceGates } from '../scripts/resource-benchmark-gates.mjs';
it('does not accept missing memory, drifting clocks or fast classifier-only timing as realtime proof', () => {
  const result = resourceGates(
    {
      mechanicalChecksPassed: true,
      clockValidForLatency: false,
      measurements: { stages: { classifier: { p95Ms: 40 } }, faceWindows: [{ hz: 5 }] },
    },
    100,
  );
  expect(result.clock).toBe(false);
  expect(result.face).toBe(false);
  expect(result.memory).toBe(false);
  expect(result.cadence).toBe(true);
  expect(result.source).toBe(false);
  const emptyTiming = resourceGates(
    { measurements: { stages: { 'partial-delivery': { count: 0, p95Ms: null } } } },
    100,
  );
  expect(emptyTiming.partial).toBe(false);
});
