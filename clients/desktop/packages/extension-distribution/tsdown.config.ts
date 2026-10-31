import { defineConfig } from 'tsdown'

export default defineConfig({
  tsconfig: './config/typescript/tsconfig.lib.json',
  entry: {
    index: 'src/index.ts',
    metadata: 'src/metadata.ts',
    identity: 'src/identity.ts',
    manifest: 'src/manifest.ts',
    registry: 'src/registry.ts',
    compatibility: 'src/compatibility.ts',
    'node/signing': 'src/node/signing.ts',
  },
  format: ['esm'],
  dts: true,
  fixedExtension: false,
  clean: true,
})
