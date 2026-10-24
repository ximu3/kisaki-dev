import { defineConfig } from 'tsdown'

export default defineConfig({
  tsconfig: './tsconfig.lib.json',
  entry: { index: 'src/index.ts', metadata: 'src/metadata.ts' },
  format: ['esm'],
  dts: true,
  fixedExtension: false,
  clean: true,
})
