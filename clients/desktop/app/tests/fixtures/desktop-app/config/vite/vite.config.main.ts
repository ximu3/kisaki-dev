/** @fileoverview Builds the editable main-process input for the development-session fixture. */

import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: true,
    target: 'node24',
    lib: {
      entry: { entry: 'src/main/entry.ts' },
      formats: ['es'],
    },
    rolldownOptions: { external: [/^node:/, 'electron'] },
  },
  ssr: { noExternal: true },
})
