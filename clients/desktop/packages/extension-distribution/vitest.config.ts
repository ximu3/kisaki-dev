import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    fsModuleCachePath: 'node_modules/.vitest-cache',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['tests/consumers/**', 'tests/fixtures/**'],
    environment: 'node',
    globals: false,
  },
})
