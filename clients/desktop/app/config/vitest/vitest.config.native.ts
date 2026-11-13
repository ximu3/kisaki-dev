import { defineConfig } from 'vitest/config'
import electronManifest from 'electron/package.json' with { type: 'json' }

if (
  process.versions.electron !== electronManifest.version ||
  process.env.ELECTRON_RUN_AS_NODE !== '1' ||
  !(Number(process.versions.napi) >= 8)
) {
  throw new Error('Native tests must start under the selected development Electron Node host')
}

export default defineConfig({
  test: {
    fsModuleCachePath: 'node_modules/.vitest-cache',
    include: [
      'tests/integration/database/**/*.test.ts',
      'tests/integration/native/**/*.test.ts',
      'tests/integration/files/**/*.test.ts',
    ],
    environment: 'node',
    pool: 'forks',
    globals: false,
    testTimeout: 30_000,
  },
})
