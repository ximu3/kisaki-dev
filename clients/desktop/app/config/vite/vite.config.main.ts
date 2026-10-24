import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '@native': fileURLToPath(new URL('../../native/node/index.ts', import.meta.url)) },
  },
  build: {
    target: 'node24',
    minify: false,
    lib: { entry: 'src/main/entry.ts', formats: ['es'], fileName: () => 'entry.js' },
    rolldownOptions: { external: [/^node:/, 'electron', 'better-sqlite3'] },
  },
})
