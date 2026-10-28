/** @fileoverview Applies shared source and test lint rules within the appearance package. */

import { defineConfig } from 'eslint/config'
import base from '@kisaki3/eslint-config/base'
import tests from '@kisaki3/eslint-config/tests'

export default defineConfig(
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
  base,
  tests,
)
