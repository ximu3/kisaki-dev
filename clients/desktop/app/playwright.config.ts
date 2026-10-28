/**
 * @fileoverview Runs the desktop window suite serially and retains failure traces and
 * screenshots.
 */

import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.test.ts',
  workers: 1,
  timeout: 30_000,
  retries: 0,
  outputDir: 'test-results/e2e',
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e/results.json' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
})
