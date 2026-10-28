/** @fileoverview Configures the extension API ESM entry and public declarations. */

import { defineConfig } from 'tsdown'

export default defineConfig({
  tsconfig: './config/typescript/tsconfig.lib.json',
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  dts: true,
  fixedExtension: false,
  clean: true,
})
