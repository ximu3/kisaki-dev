/**
 * @fileoverview Runs Solid interaction tests in headless Chromium through Vitest Browser
 * Mode.
 */

import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid({ hot: false })],
  test: {
    fsModuleCachePath: 'node_modules/.vitest-cache',
    api: { host: '127.0.0.1', port: 23315, strictPort: false },
    environment: 'node',
    include: ['tests/browser/**/*.test.tsx'],
    globals: false,
    reporters: ['default', 'json'],
    outputFile: { json: 'test-results/browser/results.json' },
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})
