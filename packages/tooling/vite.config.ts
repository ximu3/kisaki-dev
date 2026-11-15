/** @fileoverview Runs the private engineering tools against their process and filesystem tests. */

import { defineConfig } from 'vite-plus'

export default defineConfig({
  test: {
    fsModuleCachePath: 'node_modules/.vitest-cache',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
  },
})
