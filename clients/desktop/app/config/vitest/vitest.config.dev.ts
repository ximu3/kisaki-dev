/**
 * @fileoverview Runs real desktop development-session regressions serially and records
 * their results.
 */

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    fsModuleCachePath: 'node_modules/.vitest-cache',
    environment: 'node',
    globals: false,
    include: ['tests/tools/dev/**/*.test.ts'],
    testTimeout: 240_000,
    hookTimeout: 240_000,
    fileParallelism: false,
    reporters: ['default', 'json'],
    outputFile: { json: 'test-results/dev/results.json' },
  },
})
