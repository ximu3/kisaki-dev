import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    fsModuleCachePath: 'node_modules/.vitest-cache',
    environment: 'node',
    globals: false,
    include: ['tests/artifacts/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
    reporters: ['default', 'json'],
    outputFile: { json: 'test-results/artifacts/results.json' },
  },
})
