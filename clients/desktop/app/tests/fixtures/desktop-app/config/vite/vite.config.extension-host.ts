/** @fileoverview Builds the independent utility process used by the engineering fixture. */

import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: true,
    target: 'node24',
    lib: {
      entry: 'src/extension-host/entry.ts',
      formats: ['es'],
    },
    rolldownOptions: { external: [/^node:/] },
  },
  ssr: { noExternal: true },
})
