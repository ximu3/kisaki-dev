/** @fileoverview Runs pure desktop-contract tests beside their source under ordinary Node. */

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    fsModuleCachePath: 'node_modules/.vitest-cache',
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
  },
})
