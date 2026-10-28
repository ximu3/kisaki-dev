/** @fileoverview Checks the shared ESLint configuration package using its own base rules. */

import { defineConfig } from 'eslint/config'
import base from './src/base'

export default defineConfig(
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
  base,
)
