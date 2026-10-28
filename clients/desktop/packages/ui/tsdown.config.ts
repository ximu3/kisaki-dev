/**
 * @fileoverview Compiles Solid components and declarations while keeping the Solid runtime
 * external.
 */

import { defineConfig } from 'tsdown'
import solid from 'unplugin-solid/rolldown'

export default defineConfig({
  tsconfig: './config/typescript/tsconfig.lib.json',
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  dts: true,
  fixedExtension: false,
  clean: true,
  plugins: [solid()],
  deps: { neverBundle: ['solid-js', 'solid-js/web'] },
})
