import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      'dist/',
      'node_modules/',
      'scratch/',
      'data/',
      'public/',
      'commitlint.config.cjs',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
);
