/**
 * @fileoverview Bundles the main program with Node resolution while keeping Electron and
 * native runtime dependencies external.
 */

import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: true,
    target: 'node24',
    minify: false,
    lib: { entry: 'src/main/entry.ts', formats: ['es'], fileName: () => 'entry.js' },
    rolldownOptions: { external: [/^node:/, 'electron', 'better-sqlite3'] },
  },
  ssr: { target: 'node', noExternal: true },
})
