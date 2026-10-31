import { defineConfig } from 'tsdown'

export default defineConfig({
  tsconfig: './config/typescript/tsconfig.lib.json',
  entry: {
    index: 'src/index.ts',
    node: 'src/node/index.ts',
    webview: 'src/webview/index.ts',
    protocol: 'src/protocol/index.ts',
  },
  format: ['esm'],
  dts: true,
  fixedExtension: false,
  clean: true,
})
