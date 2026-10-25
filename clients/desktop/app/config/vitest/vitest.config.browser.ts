import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import solid from 'vite-plugin-solid'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [solid({ hot: false })],
  test: {
    api: { host: '127.0.0.1', port: 23315, strictPort: false },
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
