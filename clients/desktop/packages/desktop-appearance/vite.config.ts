import { defineConfig } from 'vite-plus'
import { typescriptExecutable } from '@kisaki3/tooling/typescript'

import { assembleStyles } from './tools/styles'
import manifest from './package.json' with { type: 'json' }

export default defineConfig({
  pack: {
    hooks: { 'build:done': () => assembleStyles() },
    entry: Object.fromEntries(
      Object.entries(manifest.exports)
        .filter(([, entry]) => entry['kisaki-source'].endsWith('.ts'))
        .map(([subpath, entry]) => [
          subpath === '.' ? 'index' : subpath.slice(2),
          entry['kisaki-source'],
        ]),
    ),
    tsconfig: 'tsconfig.pack.json',
    // The standalone parser includes grammar data for every supported host.
    platform: 'browser',
    deps: {
      alwaysBundle: ['css-tree', 'source-map-js'],
      onlyBundle: ['css-tree', 'source-map-js'],
    },
    target: 'es2023',
    format: 'esm',
    dts: { generator: 'tsgo', tsgo: { path: typescriptExecutable() } },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
  run: {
    tasks: {
      build: {
        command: 'vp pack',
        dependsOn: [{ task: 'build', from: 'dependencies' }],
        cache: {
          input: [{ auto: true }, { pattern: 'pnpm-lock.yaml', base: 'workspace' }],
          output: ['dist/**'],
        },
      },
      archive: { command: 'kisaki-package pack', dependsOn: ['build'], cache: false },
      'check:package': { command: 'kisaki-package check', dependsOn: ['archive'], cache: false },
      'test:consumers': {
        command: 'vp test run --config config/vitest/consumers.ts',
        dependsOn: ['check:package'],
        cache: false,
      },
    },
  },
})
