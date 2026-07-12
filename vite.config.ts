/// <reference types="vitest/config" />
import { resolve } from 'path';
import { defineConfig } from 'vite';

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
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 120000,
  },
}));
