import { defineConfig } from 'vite-plus'
import { typescriptExecutable } from '@kisaki3/tooling/typescript'

import { checkMessageTypes } from './tools/generate-messages'
import manifest from './package.json' with { type: 'json' }

export default defineConfig({
  pack: {
    hooks: { 'build:prepare': () => checkMessageTypes() },
    entry: Object.fromEntries(
      Object.entries(manifest.exports)
        .filter(([, entry]) => entry['kisaki-source'].endsWith('.ts'))
        .map(([subpath, entry]) => [
          subpath === '.' ? 'index' : subpath.slice(2),
          entry['kisaki-source'],
        ]),
    ),
    tsconfig: 'tsconfig.pack.json',
    target: 'es2023',
    format: 'esm',
    fixedExtension: false,
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
        dependsOn: [
          'check:package',
          '@kisaki3/desktop-contracts#archive',
          '@kisaki3/desktop-appearance#archive',
          '@kisaki3/extension-distribution#archive',
        ],
        cache: false,
      },
    },
  },
})
