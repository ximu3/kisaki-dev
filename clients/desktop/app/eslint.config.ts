import { defineConfig } from 'eslint/config'
import base from '@kisaki3/eslint-config/base'
import node from '@kisaki3/eslint-config/node'
import tests from '@kisaki3/eslint-config/tests'

export default defineConfig(
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
  base,
  tests,
  {
    ...node,
    files: ['src/main/**/*.ts', 'src/extension-host/**/*.ts', 'native/node/**/*.ts'],
  },
)
