/** @fileoverview Configures repository checks, formatting, staged files and CI task execution. */

import { globSync } from 'node:fs'
import { dirname } from 'node:path'
import { defineConfig, normalizePath } from 'vite-plus'

/** Standalone consumer projects are linted with their own installed tarballs and type declarations. */
const installedConsumerInputs = globSync('**/tests/consumers/fixtures/*/package.json', {
  cwd: import.meta.dirname,
  exclude: [
    'refactor/**',
    '**/{.git,.cache,.local,node_modules,dist,out,target,artifacts,test-results,playwright-report,coverage}/**',
  ],
}).map((manifest) => `${normalizePath(dirname(manifest))}/**`)

/** Native task graph roots selected together for the current CI target. */
const targetTasks = process.env.KISAKI_CI_TASKS
  ? (JSON.parse(process.env.KISAKI_CI_TASKS) as string[])
  : undefined

export default defineConfig({
  run: {
    tasks: targetTasks
      ? { 'ci:target': { command: [], dependsOn: targetTasks, cache: false } }
      : {},
  },
  fmt: {
    singleQuote: true,
    semi: false,
    sortPackageJson: false,
    ignorePatterns: [
      'refactor/**',
      'pnpm-lock.yaml',
      '**/Cargo.{toml,lock}',
      '**/*.rs',
      '**/binding.d.ts',
      '**/*.generated.ts',
      '**/*.generated.css',
      'clients/desktop/app/drizzle/**',
      '**/.cache/**',
      '**/.local/**',
      '**/target/**',
      '**/out/**',
      '**/dist/**',
      '**/test-results/**',
      '**/playwright-report/**',
    ],
  },
  lint: {
    plugins: ['typescript'],
    options: { typeAware: true },
    ignorePatterns: [
      'refactor/**',
      '**/.local/**',
      '**/.cache/**',
      '**/target/**',
      '**/dist/**',
      '**/out/**',
      '**/test-results/**',
      '**/playwright-report/**',
      '**/*.generated.ts',
      '**/binding.d.ts',
      ...installedConsumerInputs,
    ],
    rules: {
      curly: 'error',
      'no-nested-ternary': 'error',
      'typescript/consistent-type-imports': 'error',
      'typescript/no-deprecated': 'error',
      'typescript/no-explicit-any': 'error',
      'typescript/no-floating-promises': 'error',
      'typescript/no-misused-promises': 'error',
      'typescript/no-unsafe-argument': 'error',
      'typescript/no-unsafe-assignment': 'error',
      'typescript/no-unsafe-call': 'error',
      'typescript/no-unsafe-member-access': 'error',
      'typescript/no-unsafe-return': 'error',
      'typescript/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'typescript/switch-exhaustiveness-check': 'error',
    },
    overrides: [
      {
        files: ['**/tests/**'],
        rules: { 'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }] },
      },
    ],
  },
  staged: {
    '*.{ts,tsx}': [
      'vp fmt --check --no-error-on-unmatched-pattern',
      'vp lint --no-error-on-unmatched-pattern',
    ],
    '*.{json,yaml,yml,css,html,md}': 'vp fmt --check --no-error-on-unmatched-pattern',
  },
  test: {
    include: ['tools/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 30_000,
  },
})
