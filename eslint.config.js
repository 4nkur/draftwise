// ESLint flat config (ESLint v9+). Minimal rules for an ESM Node CLI.
import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off', // CLI tool — console output is intentional
      'no-empty': ['error', { allowEmptyCatch: true }], // catch {} is intentional in pathExists / cache reads
      'prefer-const': 'error',
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': 'off', // test fixtures sometimes shadow names
    },
  },
  {
    ignores: ['node_modules/**', '.draftwise/**', 'coverage/**'],
  },
];
