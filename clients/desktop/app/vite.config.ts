/** @fileoverview Configures desktop test projects and the build inputs required by each workflow. */

import { configDefaults, defineConfig } from 'vite-plus'

/** Development tests that require a live renderer and an Electron process. */
const developmentTests = ['tests/tools/dev/session.test.ts', 'tests/integration/source.test.ts']

/** Public workspace dependencies are consumed through their built entry points. */
const dependencyBuilds = { task: 'build', from: 'dependencies' } as const

/** Checks the archive identified by the caller's receipt or the current target's default receipt. */
const verifyArtifacts =
  'vp test run --project artifacts --no-file-parallelism --reporter=default --reporter=json --outputFile.json=test-results/artifacts/results.json'

export default defineConfig({
  test: {
    fsModuleCachePath: 'node_modules/.vitest-cache',
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'native/node/**/*.test.ts', 'tests/tools/**/*.test.ts'],
          exclude: [...configDefaults.exclude, ...developmentTests],
          testTimeout: 30_000,
        },
      },
      {
        test: {
          name: 'dev-session',
          include: developmentTests,
          testTimeout: 240_000,
          hookTimeout: 240_000,
        },
      },
      {
        test: {
          name: 'artifacts',
          include: ['tests/artifacts/**/*.test.ts'],
          testTimeout: 120_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
  run: {
    tasks: {
      build: {
        command: 'vpx tools/build/cli.ts',
        dependsOn: [dependencyBuilds, 'build:native', 'prepare:resources'],
        cache: false,
      },
      'package:candidate': {
        command: 'vpx tools/package/cli.ts --test-only',
        dependsOn: ['build'],
        cache: false,
      },
      typecheck: { command: 'tsc -b', dependsOn: [dependencyBuilds], cache: false },
      test: { command: 'vp test run --project unit', dependsOn: [dependencyBuilds], cache: false },
      'test:native': {
        command:
          'ELECTRON_RUN_AS_NODE=1 electron ./node_modules/vitest/vitest.mjs run --config config/vitest/native.ts',
        dependsOn: [dependencyBuilds, 'prepare:electron', 'build:native', 'prepare:resources'],
        cache: false,
      },
      'test:window-startup': {
        command: 'playwright test',
        dependsOn: ['build', 'prepare:electron'],
        cache: false,
      },
      'test:dev-session': {
        command:
          'vp test run --project dev-session --no-file-parallelism --reporter=default --reporter=json --outputFile.json=test-results/dev-session/results.json',
        dependsOn: ['prepare:electron', 'build:native', 'prepare:resources'],
        cache: false,
      },
      'test:artifacts': {
        command: verifyArtifacts,
        dependsOn: ['prepare:electron'],
        cache: false,
      },
      'test:candidate-artifacts': {
        command: 'KISAKI_ARTIFACT_RECEIPT= ' + verifyArtifacts,
        dependsOn: ['package:candidate', 'prepare:electron'],
        cache: false,
      },
      'test:performance': {
        command: [
          'vp build --config config/vite/vite.config.performance.ts',
          'playwright test --config config/playwright/playwright.config.performance.ts',
        ],
        dependsOn: ['build', 'prepare:electron'],
        cache: false,
      },
      'verify:native': {
        command: [],
        dependsOn: ['check:native', 'test:native'],
        cache: false,
      },
      verify: {
        command: [],
        dependsOn: [
          'verify:native',
          'test:window-startup',
          'test:dev-session',
          'test:candidate-artifacts',
          'test:performance',
        ],
        cache: false,
      },
    },
  },
})
