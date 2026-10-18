/** Explicit build profile only; headers alone do not make an artifact multithreaded. */
export function textWasmThreads() {
  return import.meta.env.VITE_TEXT_WASM_THREADS === '2' &&
    globalThis.crossOriginIsolated &&
    typeof SharedArrayBuffer !== 'undefined' &&
    navigator.hardwareConcurrency >= 4
    ? 2
    : 1;
}
