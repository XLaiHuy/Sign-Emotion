/** Called only inside the dedicated streaming worker, before loading its WASM module. */
export function ownWorkerChildren() {
  const NativeWorker = globalThis.Worker;
  if (typeof NativeWorker !== 'function') return () => {};
  const children = new Set<Worker>();
  let closed = false;
  globalThis.Worker = class extends NativeWorker {
    constructor(url: string | URL, options?: WorkerOptions) {
      super(url, options);
      if (closed) {
        super.terminate();
        throw new DOMException('Worker owner disposed', 'AbortError');
      }
      children.add(this);
    }
    terminate() {
      children.delete(this);
      super.terminate();
    }
  };
  return () => {
    if (closed) return;
    closed = true;
    for (const child of [...children]) child.terminate();
    children.clear();
  };
}
