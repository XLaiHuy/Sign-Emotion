import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

function gipformerResearchAssets() {
  const GIPFORMER_DIR = path.resolve(process.cwd(), 'output/research-assets/gipformer');
  const WHITELIST = new Set([
    'manifest.json',
    'encoder.int8.onnx',
    'decoder.int8.onnx',
    'joiner.int8.onnx',
    'tokens.txt',
    'sherpa.mjs',
    'asr.mjs',
    'sherpa.wasm',
  ]);

  const MIME_TYPES: Record<string, string> = {
    '.json': 'application/json',
    '.onnx': 'application/octet-stream',
    '.txt': 'text/plain; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.wasm': 'application/wasm',
  };

  const serveGipformer = (
    request: { url?: string },
    response: {
      setHeader: (name: string, value: string) => void;
      end: (data?: unknown) => void;
    },
    next: () => void,
  ) => {
    try {
      if (!request.url || !request.url.startsWith('/research/gipformer/')) {
        return next();
      }
      const rawUrl = request.url.split('?')[0];
      const filename = rawUrl.slice('/research/gipformer/'.length);

      if (
        !WHITELIST.has(filename) ||
        filename.includes('/') ||
        filename.includes('\\') ||
        filename.includes('..')
      ) {
        return next();
      }

      const filePath = path.join(GIPFORMER_DIR, filename);
      const resolved = path.resolve(filePath);
      if (!resolved.startsWith(GIPFORMER_DIR) || !fs.existsSync(resolved)) {
        return next();
      }

      const ext = path.extname(filename).toLowerCase();
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      response.setHeader('Content-Type', mime);
      response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      const data = fs.readFileSync(resolved);
      response.end(data);
    } catch {
      next();
    }
  };

  return {
    name: 'signemo-gipformer-research-assets',
    configureServer(server: { middlewares: { use: (m: typeof serveGipformer) => void } }) {
      server.middlewares.use(serveGipformer);
    },
    configurePreviewServer(server: { middlewares: { use: (m: typeof serveGipformer) => void } }) {
      server.middlewares.use(serveGipformer);
    },
  };
}

function moonshineIsolationHeaders() {
  const setForResearchUrl = (
    request: { url?: string },
    response: { setHeader: (name: string, value: string) => void },
    next: () => void,
  ) => {
    try {
      // Runtime binaries live in /public and must be served as-is, never transformed.
      if (request.url && /^\/(runtime|research)\/[^?]*\.mjs\?/.test(request.url)) {
        const [path, query = ''] = request.url.split('?');
        const kept = query.split('&').filter((part) => part !== 'import');
        request.url = kept.length ? `${path}?${kept.join('&')}` : path;
      }
      const isMoonshine =
        new URL(request.url ?? '/', 'http://localhost').searchParams.get('moonshine') === '1';
      response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      response.setHeader(
        'Cross-Origin-Embedder-Policy',
        isMoonshine ? 'require-corp' : 'credentialless',
      );
      response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
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
    gipformerResearchAssets(),
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
  optimizeDeps: {
    entries: ['index.html', 'src/**/*.{ts,tsx}'],
  },
  build: { chunkSizeWarningLimit: 1300 },
  test: {
    maxWorkers: 2,
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    exclude: ['node_modules/**', 'dist/**', 'supabase/**', 'output/**'],
  },
});
