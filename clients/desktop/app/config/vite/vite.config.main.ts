import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'node24',
    minify: false,
    lib: { entry: 'src/main/entry.ts', formats: ['es'], fileName: () => 'entry.js' },
    rolldownOptions: { external: [/^node:/, 'electron', 'better-sqlite3'] },
  },
})
