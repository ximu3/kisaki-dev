import { defineConfig } from 'vite'

const preloadEntries = {
  main: 'src/preload/main.ts',
  reader: 'src/preload/reader.ts',
  player: 'src/preload/player.ts',
  'game-panel': 'src/preload/game-panel.ts',
}

export default defineConfig({
  build: {
    target: 'node24',
    minify: false,
    lib: {
      entry: preloadEntries,
      formats: ['cjs'],
      fileName: (_format, name) => `${name}.cjs`,
    },
    // Sandbox preload may require only Electron's allowed built-ins. Each entry is bundled alone.
    rolldownOptions: {
      external: ['electron'],
      output: { codeSplitting: false },
    },
  },
})
