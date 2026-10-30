import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    fsModuleCachePath: 'node_modules/.vitest-cache',
    include: ['tools/**/*.test.ts', 'tests/tools/**/*.test.ts'],
    environment: 'node',
    globals: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
