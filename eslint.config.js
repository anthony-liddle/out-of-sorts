import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
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
  {
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  prettier,
);
