/** @fileoverview Compiles the Electron main process and its application database worker. */

import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: true,
    target: 'node24',
    lib: {
      entry: { entry: 'src/main/entry.ts', database: 'src/main/app/database-worker.ts' },
      formats: ['es'],
    },
    rolldownOptions: { external: [/^node:/, 'electron'] },
  },
  ssr: { noExternal: true },
})
