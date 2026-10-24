import { defineConfig } from 'tsdown'

export default defineConfig({
  tsconfig: './tsconfig.lib.json',
  entry: { index: 'src/index.ts', errors: 'src/errors.ts' },
  format: ['esm'],
  dts: true,
  fixedExtension: false,
  clean: true,
})
