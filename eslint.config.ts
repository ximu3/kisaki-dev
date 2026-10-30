/**
 * @fileoverview Applies shared lint rules to repository-owned code and excludes retained
 * evidence and artifacts.
 */

import { defineConfig } from 'eslint/config'
import base, { syntaxOnly } from '@kisaki3/eslint-config/base'
import tests from '@kisaki3/eslint-config/tests'

export default defineConfig(
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
  { ignores: ['refactor/**', 'artifacts/**'] },
  base,
  tests,
  {
    // Full typed lint runs in the isolated consumer after its tarballs are installed.
    ...syntaxOnly,
    files: ['tests/desktop/fixtures/consumers/**'],
  },
)
