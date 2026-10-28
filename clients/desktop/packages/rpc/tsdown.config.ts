/** @fileoverview Configures ESM and declaration outputs for RPC transport contracts. */

import { defineConfig } from 'tsdown'

export default defineConfig({
  tsconfig: './config/typescript/tsconfig.lib.json',
  entry: { index: 'src/index.ts', transport: 'src/transport.ts' },
  format: ['esm'],
  dts: true,
  fixedExtension: false,
  clean: true,
})
