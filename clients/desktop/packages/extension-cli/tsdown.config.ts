import { defineConfig } from 'tsdown'

export default defineConfig({
  tsconfig: './config/typescript/tsconfig.lib.json',
  entry: { config: 'src/config.ts' },
  format: ['esm'],
  dts: true,
  fixedExtension: false,
  clean: true,
})
