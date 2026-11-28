import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: true,
    target: 'node24',
    lib: {
      entry: {
        entry: 'src/main/entry.ts',
        database: 'src/main/app/database-worker.ts',
        'file-rules': 'src/main/features/library/holdings/recognition/worker.ts',
      },
      formats: ['es'],
    },
    rolldownOptions: { external: [/^node:/, 'electron'] },
  },
  ssr: { noExternal: true },
})
