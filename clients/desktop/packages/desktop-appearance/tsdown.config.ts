import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/tokens.ts', 'src/values.ts', 'src/defaults.ts'],
  tsconfig: 'config/typescript/tsconfig.lib.json',
  // Bundle CSS Tree's browser data entry so pure consumers never load its Node data loader.
  platform: 'browser',
  deps: {
    alwaysBundle: ['css-tree', 'source-map-js'],
    onlyBundle: ['css-tree', 'source-map-js'],
  },
  target: 'es2023',
  format: 'esm',
  dts: true,
})
