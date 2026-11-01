import { defineConfig } from 'eslint/config'
import base from '@kisaki3/eslint-config/base'
import tests from '@kisaki3/eslint-config/tests'
import tseslint from 'typescript-eslint'

export default defineConfig(
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
  { ignores: ['refactor/**', 'artifacts/**'] },
  base,
  tests,
  {
    files: ['tests/desktop/consumers/fixtures/**/*.ts'],
    extends: [tseslint.configs.disableTypeChecked],
  },
)
