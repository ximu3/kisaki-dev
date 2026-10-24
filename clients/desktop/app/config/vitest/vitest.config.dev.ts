import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
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
