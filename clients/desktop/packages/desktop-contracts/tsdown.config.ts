import { defineConfig } from 'tsdown'

export default defineConfig({
  tsconfig: './config/typescript/tsconfig.lib.json',
  entry: { index: 'src/index.ts', errors: 'src/errors.ts', development: 'src/development.ts' },
  format: ['esm'],
  dts: true,
  fixedExtension: false,
  clean: true,
})
