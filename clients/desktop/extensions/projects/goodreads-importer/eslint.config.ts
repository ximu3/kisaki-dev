/**
 * @fileoverview Configures lint rules for the official goodreads-importer extension
 * project.
 */

import { defineConfig } from 'eslint/config'
import base from '@kisaki3/eslint-config/base'

export default defineConfig(
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
  base,
)
