/** @fileoverview Declares the public RPC entry for library builds and transport verification. */

import { defineLibrary } from '@kisaki3/config/vite/library'

export default defineLibrary({
  entries: {
    '.': './src/index.ts',
  },
})
