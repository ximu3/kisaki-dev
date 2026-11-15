/** @fileoverview Verifies the prepared engineering fixture in real Electron windows. */

import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/integration/electron',
  testMatch: '**/*.test.ts',
  workers: 1,
  outputDir: 'test-results/window-startup',
  reporter: [['list'], ['json', { outputFile: 'test-results/window-startup/results.json' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
})
