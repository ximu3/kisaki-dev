/**
 * @fileoverview Runs desktop startup measurements serially and records their performance
 * report.
 */

import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '../../tests/performance',
  testMatch: '**/*.test.ts',
  workers: 1,
  retries: 0,
  timeout: 180_000,
  outputDir: '../../test-results/performance',
  reporter: [['list'], ['json', { outputFile: '../../test-results/performance/results.json' }]],
})
