/** @fileoverview Builds the English localization library and verifies its generated message contracts. */

import { defineLibrary } from '@kisaki3/config/vite/library'

export default defineLibrary({
  entries: {
    '.': './src/index.ts',
  },
  generated: { task: 'generate:messages', command: 'vpx tools/generate-messages.ts' },
})
