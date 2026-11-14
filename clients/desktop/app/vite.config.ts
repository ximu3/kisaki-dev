import { defineConfig } from 'vite-plus'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'native/node/**/*.test.ts', 'tests/tools/**/*.test.ts'],
    exclude: ['tests/tools/dev/session.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
  },
  run: {
    tasks: {
      'build:fixture': {
        command: 'vpx tools/build/cli.ts --source tests/fixtures/desktop-app',
        dependsOn: [{ task: 'build', from: 'dependencies' }, 'build:native', 'prepare:resources'],
        cache: false,
      },
      'package:fixture': {
        command: 'vpx tools/package/cli.ts --test-only',
        dependsOn: ['build:fixture'],
        cache: false,
      },
      'test:native': {
        command:
          'cross-env ELECTRON_RUN_AS_NODE=1 electron ./node_modules/vitest/vitest.mjs run --config config/vitest/vitest.config.native.ts',
        dependsOn: [
          { task: 'build', from: 'dependencies' },
          'prepare:electron',
          'build:native',
          'prepare:resources',
        ],
        cache: false,
      },
      'test:windows': {
        command: 'playwright test',
        dependsOn: ['build:fixture', 'prepare:electron'],
        cache: false,
      },
      'test:dev': {
        command: 'vp test run --config config/vitest/vitest.config.dev.ts',
        dependsOn: ['prepare:electron', 'build:native', 'prepare:resources'],
        cache: false,
      },
      'test:artifacts': {
        command: 'vp test run --config config/vitest/vitest.config.artifacts.ts',
        dependsOn: ['package:fixture'],
        cache: false,
      },
      'test:performance': {
        command: [
          'vp build --config config/vite/vite.config.performance.ts',
          'playwright test --config config/playwright/playwright.config.performance.ts',
        ],
        dependsOn: ['build:fixture', 'prepare:electron'],
        cache: false,
      },
    },
  },
})
