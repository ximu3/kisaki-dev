import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid({ hot: false })],
  test: {
    environment: 'node',
    include: ['tests/browser/**/*.test.tsx'],
    globals: false,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})
