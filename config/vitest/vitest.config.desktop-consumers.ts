/** @fileoverview Runs isolated desktop package consumer tests and records their results. */

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    fsModuleCachePath: 'node_modules/.vitest-cache',
    environment: 'node',
    globals: false,
    include: ['tests/desktop/consumers/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    reporters: ['default', 'json'],
    outputFile: { json: 'test-results/desktop/consumers/results.json' },
  },
})
