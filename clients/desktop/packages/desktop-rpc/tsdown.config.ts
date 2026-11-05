import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  tsconfig: 'config/typescript/tsconfig.lib.json',
  target: 'es2023',
  format: 'esm',
  fixedExtension: false,
  dts: true,
})
