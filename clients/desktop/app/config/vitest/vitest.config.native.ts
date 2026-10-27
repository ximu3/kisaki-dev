import { defineConfig } from 'vitest/config'
import { readFileSync } from 'node:fs'

const manifest: { devDependencies: { electron: string } } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
)
if (
  process.versions.electron !== manifest.devDependencies.electron ||
  process.env.ELECTRON_RUN_AS_NODE !== '1' ||
  !(Number(process.versions.napi) >= 8)
) {
  throw new Error('Native tests must start under the selected development Electron Node host')
}

export default defineConfig({
  test: {
    fsModuleCachePath: 'node_modules/.vitest-cache',
    include: ['tests/integration/database/**/*.test.ts', 'tests/integration/native/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
    globals: false,
    testTimeout: 30_000,
  },
})
