/**
 * @fileoverview Configures Node ESM outputs for extension build configuration and
 * development application control.
 */

import { defineConfig } from 'tsdown'

export default defineConfig({
  tsconfig: './config/typescript/tsconfig.node.json',
  entry: { config: 'src/config.ts', extension: 'src/extension.ts' },
  format: ['esm'],
  dts: true,
  fixedExtension: false,
  clean: true,
})
