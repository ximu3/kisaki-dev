import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/integration/electron',
  testMatch: '**/*.test.ts',
  workers: 1,
  timeout: 30_000,
  retries: 0,
  outputDir: 'test-results/windows',
  reporter: [['list'], ['json', { outputFile: 'test-results/windows/results.json' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
})
