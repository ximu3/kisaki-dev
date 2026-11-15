/** @fileoverview Builds the RPC library and prepares its independent Electron transport checks. */

import { defineLibrary } from '@kisaki3/config/vite/library'

export default defineLibrary({
  entries: {
    '.': './src/index.ts',
  },
  prepareConsumers: ['@kisaki3/desktop#prepare:electron'],
})
