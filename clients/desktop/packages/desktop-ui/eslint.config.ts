import { defineConfig } from 'eslint/config'
import base from '@kisaki3/eslint-config/base'
import tests from '@kisaki3/eslint-config/tests'
import tseslint from 'typescript-eslint'

export default defineConfig(
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
  base,
  tests,
  {
    files: ['tests/fixtures/**/*.ts', 'tests/fixtures/**/*.tsx'],
    extends: [tseslint.configs.disableTypeChecked],
  },
)
