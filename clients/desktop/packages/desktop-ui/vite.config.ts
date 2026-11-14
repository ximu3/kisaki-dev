import { defineConfig } from 'vite-plus'
import { typescriptExecutable } from '@kisaki3/tooling/typescript'
import solid from 'unplugin-solid/rolldown'

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
    platform: 'browser',
    target: 'es2023',
    format: 'esm',
    dts: { generator: 'tsgo', tsgo: { path: typescriptExecutable() } },
    deps: {
      onlyBundle: ['@unovis/solid', '@unovis/ts'],
      dts: { alwaysBundle: ['@unovis/solid', '@unovis/ts'] },
    },
    plugins: [solid()],
    css: { fileName: 'components.css', modules: { generateScopedName: 'kui_[hash]_[local]' } },
  },
  test: {
    include: ['tests/browser/**/*.test.{ts,tsx}'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
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
        dependsOn: [
          '@kisaki3/desktop#prepare:electron',
          'check:package',
          '@kisaki3/desktop-appearance#archive',
        ],
        cache: false,
      },
    },
  },
})
