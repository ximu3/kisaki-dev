import { defineConfig } from 'vitest/config'

if (process.versions.electron !== '44.5.1' || process.env.ELECTRON_RUN_AS_NODE !== '1') {
  throw new Error('Native tests must start under the selected development Electron Node host')
}

export default defineConfig({
  test: {
    include: ['tests/integration/database/**/*.test.ts', 'tests/integration/native/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
    globals: false,
    testTimeout: 30_000,
  },
})
