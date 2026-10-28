/**
 * @fileoverview Bundles the extension-host program with Node resolution while retaining
 * native Node imports.
 */

import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: true,
    target: 'node24',
    minify: false,
    lib: { entry: 'src/extension-host/entry.ts', formats: ['es'], fileName: () => 'entry.js' },
    rolldownOptions: { external: [/^node:/] },
  },
  ssr: { target: 'node', noExternal: true },
})
