import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    fsModuleCachePath: 'node_modules/.vitest-cache',
    environment: 'node',
    globals: false,
    include: [
      'src/**/*.test.ts',
      'native/node/**/*.test.ts',
      'tools/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/tools/**/*.test.ts',
    ],
    exclude: ['tests/integration/database/**', 'tests/integration/native/**', 'tests/tools/dev/**'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
