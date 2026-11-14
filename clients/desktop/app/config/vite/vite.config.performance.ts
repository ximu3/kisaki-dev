import { defineConfig } from 'vite-plus'

export default defineConfig({
  build: {
    ssr: true,
    target: 'node24',
    outDir: 'out/performance',
    lib: {
      entry: 'tests/performance/storage/worker.ts',
      formats: ['es'],
      fileName: () => 'worker.js',
    },
    rolldownOptions: { external: [/^node:/] },
  },
  ssr: { target: 'node', noExternal: true },
})
