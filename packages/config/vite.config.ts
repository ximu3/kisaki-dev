import { defineConfig } from 'vite-plus'

export default defineConfig({
  run: {
    tasks: {
      typecheck: { command: 'tsc -b', cache: false },
    },
  },
})
