import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: [
      'src/**/*.test.ts',
      'native/node/**/*.test.ts',
      'tools/**/*.test.ts',
      'tests/tools/**/*.test.ts',
    ],
    exclude: ['tests/tools/dev/**'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
