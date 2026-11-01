import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/tools',
  projects: [
    { name: 'runtime', testMatch: 'electron.test.ts', outputDir: 'test-results/runtime' },
    {
      name: 'package',
      testMatch: 'package.test.ts',
      outputDir: 'test-results/package',
      timeout: 600_000,
    },
  ],
  workers: 1,
  timeout: 30_000,
  retries: 0,
  reporter: [['list']],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
})
