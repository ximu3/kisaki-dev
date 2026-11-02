import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/manifest.ts',
    'src/registry.ts',
    'src/metadata.ts',
    'src/compatibility.ts',
    'src/errors.ts',
    'src/node/signing.ts',
  ],
  tsconfig: 'config/typescript/tsconfig.node.json',
  target: 'es2023',
  format: 'esm',
  fixedExtension: false,
  dts: true,
})
