/** @fileoverview Builds the engineering fixture main process and the deployed SQLite worker. */

import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: true,
    target: 'node24',
    lib: {
      entry: {
        entry: 'src/main/entry.ts',
        database: '../../../src/main/infrastructure/database/executor/worker.ts',
      },
      formats: ['es'],
    },
    // Bundle the driver's JavaScript; initializeDatabase supplies the deployed nativeBinding path.
    rolldownOptions: { external: [/^node:/, 'electron'] },
  },
  ssr: { noExternal: true },
})
