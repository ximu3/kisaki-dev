/**
 * @fileoverview Provides shared TypeScript checks for control flow, asynchronous work and
 * typed values, excluding generated and local engineering output.
 */

import eslint from '@eslint/js'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

/** Check consumer templates before their declaration dependencies are installed. */
export const syntaxOnly = tseslint.configs.disableTypeChecked

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/target/**',
      '**/test-results/**',
      '**/playwright-report/**',
      '**/.cache/**',
      '**/.local/**',
      '**/.turbo/**',
      '**/.vitest/**',
      '**/binding.d.ts',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      curly: ['error', 'all'],
      'no-nested-ternary': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },
)
