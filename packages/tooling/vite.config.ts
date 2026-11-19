/** @fileoverview Defines the engineering tools' tasks and configures their process and filesystem tests. */

import { defineConfig } from 'vite-plus'

export default defineConfig({
  test: {
    fsModuleCachePath: 'node_modules/.vitest-cache',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
  },

  run: {
    tasks: {
      typecheck: { command: 'tsc -b', cache: false },
      test: { command: 'vp test run', cache: false },
    },
  },
})
