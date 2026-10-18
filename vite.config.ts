import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

function moonshineIsolationHeaders() {
  const setForResearchUrl = (
    request: { url?: string },
    response: { setHeader: (name: string, value: string) => void },
    next: () => void,
  ) => {
    try {
      if (new URL(request.url ?? '/', 'http://localhost').searchParams.get('moonshine') === '1') {
        response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      }
    } catch {
      // Ignore malformed request URLs and let Vite handle them normally.
    }
    next();
  };
  return {
    name: 'signemo-moonshine-local-isolation',
    configureServer(server: {
      middlewares: { use: (middleware: typeof setForResearchUrl) => void };
    }) {
      server.middlewares.use(setForResearchUrl);
    },
    configurePreviewServer(server: {
      middlewares: { use: (middleware: typeof setForResearchUrl) => void };
    }) {
      server.middlewares.use(setForResearchUrl);
    },
  };
}

export default defineConfig({
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(
      process.env.VITE_BUILD_ID || `local-${new Date().toISOString()}`,
    ),
  },
  plugins: [
    react(),
    tailwind(),
    moonshineIsolationHeaders(),
    VitePWA({
      registerType: 'prompt',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff2}', 'demo/manifest.json'],
        globIgnores: ['models/**', 'runtime/**', '**/ExpressionAvatar-*.js'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: 'SignEmo — Kết nối qua từng biểu cảm',
        short_name: 'SignEmo',
        description: 'Phụ đề tiếng Việt và gợi ý sắc thái từ camera, micro; xử lý trên thiết bị.',
        lang: 'vi',
        start_url: '/',
        display: 'standalone',
        background_color: '#f6f8f4',
        theme_color: '#176d57',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  worker: { format: 'es' },
  build: { chunkSizeWarningLimit: 1300 },
  test: {
    maxWorkers: 2,
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    exclude: ['node_modules/**', 'dist/**', 'supabase/**', 'output/**'],
  },
});
