/**
 * @fileoverview Provides the shared TypeScript lint baseline and exclusions for generated
 * and local engineering output.
 */

import eslint from '@eslint/js'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

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
    rules: {
      curly: ['error', 'multi-line', 'consistent'],
      'no-nested-ternary': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-syntax': [
        'error',
        { selector: 'ExportAllDeclaration', message: 'List public exports explicitly.' },
      ],
    },
  },
)
