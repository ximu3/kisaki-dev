/** @fileoverview Provides test-specific lint allowances for framework fixture parameters. */

import type { Linter } from 'eslint'

/** Test fixtures may use the empty parameter object required by Playwright. */
export default {
  files: ['**/tests/**/*.test.ts', '**/tests/support/**/*.ts'],
  rules: { 'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }] },
} satisfies Linter.Config
