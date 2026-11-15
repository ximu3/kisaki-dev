/** @fileoverview Bundles the storage workload for the Electron performance worker. */

import { defineConfig } from 'vite-plus'

export default defineConfig({
  build: {
    ssr: 'tests/performance/storage/worker.ts',
    target: 'node24',
    outDir: 'out/performance',
    rolldownOptions: { external: [/^node:/] },
  },
  ssr: { noExternal: true },
})
