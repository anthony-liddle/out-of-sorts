/// <reference types="vitest/config" />
import { appendFileSync } from 'node:fs';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Connect } from 'vite';

// Collects cold start timing reports POSTed by the instrumentation page,
// including from phones on the LAN. Dev and preview servers only; never
// part of the shipped app.
const reportMiddleware: Connect.NextHandleFunction = (req, res, next) => {
  if (req.url !== '/__cold-start-report' || req.method !== 'POST') {
    next();
    return;
  }
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    appendFileSync('cold-start-measurements.jsonl', body.trim() + '\n');
    res.statusCode = 204;
    res.end();
  });
};

// The fdroid mode is the F-Droid build flavour. It compiles __ANALYTICS__ to
// false so the @vercel/analytics import is dead code and never enters the
// bundle. F-Droid forbids proprietary analytics dependencies outright; the
// package must be absent, not disabled at runtime.
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
    },
  },
  define: {
    __ANALYTICS__: JSON.stringify(mode !== 'fdroid'),
  },
  plugins: [
    react(),
    {
      name: 'cold-start-report',
      configureServer(server) {
        server.middlewares.use(reportMiddleware);
      },
      configurePreviewServer(server) {
        server.middlewares.use(reportMiddleware);
      },
    },
  ],
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 120000,
  },
}));
