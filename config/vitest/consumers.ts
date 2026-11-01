import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    fsModuleCachePath: 'node_modules/.vitest-cache',
    include: ['tests/desktop/consumers/**/*.test.ts'],
    environment: 'node',
    globals: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    reporters: ['default', 'json'],
    outputFile: 'test-results/consumers/results.json',
  },
})
