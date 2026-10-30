import { defineConfig } from 'tsdown'

export default defineConfig({
  tsconfig: './config/typescript/tsconfig.lib.json',
  entry: { index: 'src/index.ts', tokens: 'src/tokens.ts' },
  format: ['esm'],
  dts: true,
  fixedExtension: false,
  clean: true,
  copy: ['src/tailwind.css'],
})
