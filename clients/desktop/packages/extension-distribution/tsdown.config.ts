/** @fileoverview Configures ESM and declaration outputs for extension metadata entries. */

import { defineConfig } from 'tsdown'

export default defineConfig({
  tsconfig: './config/typescript/tsconfig.lib.json',
  entry: { index: 'src/index.ts', metadata: 'src/metadata.ts' },
  format: ['esm'],
  dts: true,
  fixedExtension: false,
  clean: true,
})
