import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { defineConfig } from 'vite-plus'
import type { PackUserConfig } from 'vite-plus/pack'

interface LibraryOptions {
  entries: Record<string, string>
  /** The generator accepts --check to verify its committed output. */
  generated?: { task: string; command: string }
  pack?: Pick<PackUserConfig, 'platform' | 'hooks' | 'plugins' | 'deps' | 'css'>
  browserTests?: boolean
  consumerHookTimeout?: number
}

const dependencyBuilds = { task: 'build', from: 'dependencies' } as const

const buildInputs = [
  { auto: true },
  { pattern: 'pnpm-lock.yaml', base: 'workspace' as const },
  { pattern: 'packages/config/vite/**', base: 'workspace' as const },
]

const requireTypeScript = createRequire(import.meta.resolve('typescript/package.json'))
const nativeCompilerManifest = requireTypeScript.resolve(
  `@typescript/typescript-${process.platform}-${process.arch}/package.json`,
)

/** tsdown detects 7.0 automatically; pin its generator to the installed 7.1 executable. */
const tscPath = join(
  dirname(nativeCompilerManifest),
  'lib',
  process.platform === 'win32' ? 'tsc.exe' : 'tsc',
)

export function defineLibrary({
  entries,
  generated,
  pack,
  browserTests = false,
  consumerHookTimeout = 120_000,
}: LibraryOptions) {
  const sources = Object.entries(entries).map(([subpath, source]) => ({
    subpath,
    source,
    outputName: subpath === '.' ? 'index' : subpath.slice(2),
  }))
  const programs = sources.filter(({ source }) => !source.endsWith('.css'))
  const testName = browserTests ? 'browser' : 'unit'
  const consumerReport =
    '--reporter=default --reporter=json --outputFile.json=test-results/consumers/results.json'

  return defineConfig({
    pack: {
      ...pack,
      entry: Object.fromEntries(programs.map(({ outputName, source }) => [outputName, source])),
      tsconfig: 'tsconfig.pack.json',
      target: 'es2023',
      fixedExtension: false,
      dts: { generator: 'tsgo', tsgo: { path: tscPath } },
      exports: {
        devExports: 'kisaki-source',
        inlinedDependencies: false,

        customExports(_generated, { isPublish }) {
          return Object.fromEntries(
            sources.map(({ subpath, source, outputName }) => {
              const output = './dist/' + outputName
              const published = source.endsWith('.css')
                ? { default: output }
                : { types: output + '.d.ts', import: output + '.js' }
              return [subpath, isPublish ? published : { 'kisaki-source': source, ...published }]
            }),
          )
        },
      },
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
