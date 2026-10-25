import eslint from '@eslint/js'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig(
  {
    ignores: [
      'refactor/**',
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
      'artifacts/**',
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
  {
    files: ['**/tests/**/*.test.ts', '**/tests/support/**/*.ts'],
    rules: {
      // Playwright requires an object pattern even when a fixture has no dependencies.
      'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }],
    },
  },
  {
    files: [
      'clients/desktop/app/src/main/**/*.ts',
      'clients/desktop/app/src/extension-host/**/*.ts',
      'clients/desktop/app/native/node/**/*.ts',
    ],
    rules: {
      // Electron's declarations reference DOM types; their availability is not a main-process API.
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'navigator',
        'localStorage',
        'sessionStorage',
        'HTMLElement',
        'requestAnimationFrame',
      ],
    },
  },
)
