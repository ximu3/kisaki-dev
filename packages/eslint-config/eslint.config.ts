import { defineConfig } from 'eslint/config'
import base from './src/base'

export default defineConfig(
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
  base,
)
