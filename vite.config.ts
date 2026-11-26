import { defineConfig } from 'vite-plus'

const ignoredFiles = [
  'refactor/**',
  '**/.cache/**',
  '**/.local/**',
  '**/target/**',
  '**/dist/**',
  '**/out/**',
  '**/test-results/**',
  '**/playwright-report/**',
  '**/*.generated.ts',
  '**/binding.d.ts',
]

export default defineConfig({
  run: {
    tasks: {
      build: { command: 'vp run -r build', cache: false },

      typecheck: {
        command: ['vp run -r typecheck', 'tsc -b'],
        cache: false,
      },
      lint: {
        command: [
          'vp run --filter "./clients/desktop/packages/*" build',
          'vp lint',
          'pnpm exec node tools/boundaries.ts',
        ],
        cache: false,
      },
      test: {
        command: ['vp run -r test', 'pnpm exec vp test run'],
        cache: false,
      },
      check: {
        command: ['vp run typecheck', 'vp run lint', 'vp fmt --check', 'vp run test'],
        cache: false,
      },

      clean: { command: 'vp run -r clean', cache: false },
    },
  },

  fmt: {
    singleQuote: true,
    semi: false,
    sortPackageJson: false,
    ignorePatterns: [
      ...ignoredFiles,
      '**/Cargo.{toml,lock}',
      '**/*.generated.css',
      'clients/desktop/app/drizzle/**',
    ],
  },
  lint: {
    plugins: ['typescript'],
    options: { typeAware: true },
    ignorePatterns: [...ignoredFiles, '**/tests/consumers/fixtures/*/**'],
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
