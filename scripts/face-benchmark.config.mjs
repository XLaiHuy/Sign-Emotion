import { defineConfig } from 'vite';
// Isolated synthetic harness; does not alter the production PWA or its assets.
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'output/face-benchmark',
    emptyOutDir: true,
    rollupOptions: { input: 'tests/browser/face-preprocessing.html' },
  },
  worker: { format: 'es' },
});
