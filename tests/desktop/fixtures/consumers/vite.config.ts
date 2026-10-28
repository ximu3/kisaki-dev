/**
 * @fileoverview Builds the standalone framework-independent and Solid consumer documents
 * with public package imports.
 */

import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [solid()],
  build: {
    rolldownOptions: {
      input: { webview: resolve('webview/index.html'), solid: resolve('solid/index.html') },
    },
  },
})
