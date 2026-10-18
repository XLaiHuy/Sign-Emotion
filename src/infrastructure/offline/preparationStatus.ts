import { useSyncExternalStore } from 'react';

export interface PreparationStatus {
  coreReady: boolean;
  fusionReady: boolean;
  offline: boolean;
  preparing: boolean;
  progress: number;
  detail: string;
  error: string;
}

const initial: PreparationStatus = {
  coreReady: false,
  fusionReady: false,
  offline: false,
  preparing: false,
  progress: 0,
  detail: '',
  error: '',
};

let snapshot = initial;
let runner: (() => void) | null = null;
const listeners = new Set<() => void>();

export function updatePreparationStatus(patch: Partial<PreparationStatus>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
}

export function usePreparationStatus() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => initial,
  );
}

export function registerPreparationRunner(start: () => void) {
  runner = start;
  return () => {
    if (runner === start) runner = null;
  };
}

export function retryModelPreparation() {
  runner?.();
}
