/** @fileoverview Configures public ESM library builds, tarball verification and output cleanup. */

import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { defineConfig } from 'vite-plus'
import type { PackUserConfig } from 'vite-plus/pack'

/** The public subpaths and authored source files belonging to one library. */
interface LibraryOptions {
  /** Public subpaths mapped to source programs or stylesheets. */
  entries: Record<string, string>
  /** Optional source generator whose --check mode validates a finite build. */
  generated?: { task: string; command: string }
  pack?: PackUserConfig
  browserTests?: boolean
  consumerHookTimeout?: number
}

/** Workspace production dependencies supply built exports before a reader starts. */
const dependencyBuilds = { task: 'build', from: 'dependencies' } as const

/** Both source validation and packaging depend on the files they read and the locked build tools. */
const buildInputs = [
  { auto: true },
  { pattern: 'pnpm-lock.yaml', base: 'workspace' as const },
  { pattern: 'packages/config/vite/**', base: 'workspace' as const },
]

/** Resolves TypeScript from the configuration package that declares the compiler. */
const compiler = createRequire(import.meta.resolve('typescript/package.json'))

/** The native compiler package installed for this host. */
const platform = compiler.resolve(
  `@typescript/typescript-${process.platform}-${process.arch}/package.json`,
)

/** tsdown detects 7.0 automatically; pin its generator to the installed 7.1 executable. */
const tsc = join(dirname(platform), 'lib', process.platform === 'win32' ? 'tsc.exe' : 'tsc')

/**
 * Configures compilation, source and published exports, package checks and independent consumers.
 * Package-specific hooks, plugins and browser tests belong to the caller.
 */
export function defineLibrary({
  entries,
  generated,
  pack,
  browserTests = false,
  consumerHookTimeout = 120_000,
}: LibraryOptions) {
  const sources = Object.entries(entries)
  const programs = sources.filter(([, source]) => !source.endsWith('.css'))
  const testName = browserTests ? 'browser' : 'unit'
  const consumerReport =
    '--reporter=default --reporter=json --outputFile.json=test-results/consumers/results.json'

  return defineConfig({
    pack: {
      entry: Object.fromEntries(
        programs.map(([name, source]) => [name === '.' ? 'index' : name.slice(2), source]),
      ),
      tsconfig: 'tsconfig.pack.json',
      target: 'es2023',
      fixedExtension: false,
      dts: { generator: 'tsgo', tsgo: { path: tsc } },
      exports: {
        devExports: 'kisaki-source',
        inlinedDependencies: false,

        /** Preserves public condition order and includes the styles assembled by the package. */
        customExports(_generated, { isPublish }) {
          return Object.fromEntries(
            sources.map(([name, source]) => {
              const output = './dist/' + (name === '.' ? 'index' : name.slice(2))
              const published = source.endsWith('.css')
                ? { default: output }
                : { types: output + '.d.ts', import: output + '.js' }
              return [name, isPublish ? published : { 'kisaki-source': source, ...published }]
            }),
          )
        },
      },
      ...pack,
    },

    test: {
      fsModuleCachePath: 'node_modules/.vitest-cache',
      projects: [
        {
          test: browserTests
            ? {
                name: testName,
                include: ['tests/browser/**/*.test.{ts,tsx}'],
                testTimeout: 60_000,
                hookTimeout: 60_000,
              }
            : { name: testName, include: ['src/**/*.test.{ts,tsx}'] },
        },
        {
          test: {
            name: 'consumers',
            include: ['tests/consumers/**/*.test.ts'],
            testTimeout: 60_000,
            hookTimeout: consumerHookTimeout,
          },
        },
      ],
    },

    run: {
      tasks: {
        ...(generated && {
          [generated.task]: {
            command: generated.command,
            dependsOn: [dependencyBuilds],
            cache: false,
          },
          'check:generated': {
            command: generated.command + ' --check',
            dependsOn: [dependencyBuilds],
            cache: { input: buildInputs, output: [] },
          },
        }),
        build: {
          command: 'vp pack',
          dependsOn: generated ? ['check:generated'] : [dependencyBuilds],
          cache: {
            input: buildInputs,
            output: ['dist/**'],
          },
        },

        pack: {
          command: 'pnpm pack --out out/package/package.tgz',
          dependsOn: ['build', { task: 'pack', from: 'dependencies' }],
          cache: false,
        },
        'check:package': {
          command: [
            'publint --strict --level warning out/package/package.tgz',
            'attw out/package/package.tgz',
          ],
          dependsOn: ['pack'],
          cache: false,
        },

        typecheck: { command: 'tsc -b', dependsOn: [dependencyBuilds], cache: false },
        [browserTests ? 'test:browser' : 'test']: {
          command:
            'vp test run --project ' + testName + (browserTests ? ' --no-file-parallelism' : ''),
          dependsOn: [dependencyBuilds],
          cache: false,
        },
        'test:consumers': {
          command: 'vp test run --project consumers ' + consumerReport,
          dependsOn: ['check:package'],
          cache: false,
        },
        verify: {
          command: [],
          dependsOn: browserTests ? ['test:consumers', 'test:browser'] : ['test:consumers'],
          cache: false,
        },

        clean: { command: 'kisaki-clean', cache: false },
      },
    },
  })
}
