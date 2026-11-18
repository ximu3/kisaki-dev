/** @fileoverview Declares the independent, self-contained preloads compiled for each native document. */

import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'node24',
    lib: {
      entry: {
        main: 'src/preload/main.ts',
        reader: 'src/preload/reader.ts',
        player: 'src/preload/player.ts',
        'game-panel': 'src/preload/game-panel.ts',
      },
      formats: ['cjs'],
    },
    rolldownOptions: { external: ['electron'], output: { codeSplitting: false } },
  },
})
