/** @fileoverview Checks the shared configuration package with its own TypeScript project. */

import { defineConfig } from 'vite-plus'

export default defineConfig({
  run: {
    tasks: {
      typecheck: { command: 'tsc -b', cache: false },
    },
  },
})
