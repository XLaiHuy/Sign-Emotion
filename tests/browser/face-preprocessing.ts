const worker = new Worker(new URL('./face-preprocessing.worker.ts', import.meta.url), {
  type: 'module',
});
worker.onmessage = (event) => {
  document.querySelector('#result')!.textContent = JSON.stringify(
    { ...event.data, userAgent: navigator.userAgent },
    null,
    2,
  );
  document.documentElement.dataset.done = 'true';
  worker.terminate();
};
worker.onerror = (event) => {
  document.querySelector('#result')!.textContent = event.message;
  document.documentElement.dataset.done = 'error';
  worker.terminate();
};
worker.postMessage({});
export {};
