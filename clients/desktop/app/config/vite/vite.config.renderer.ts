/** @fileoverview Builds all native Solid documents and grants the local development server its HMR connection. */

import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import tailwind from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

/** Root of the native document entry pages. */
const root = fileURLToPath(new URL('../../src/renderer/windows', import.meta.url))

export default defineConfig(({ mode }) => ({
  root,
  base: './',
  plugins: [
    solid(),
    tailwind(),
    {
      name: 'kisaki-development-document',
      /** Keeps Vite's development bootstrap and local HMR sockets within the source session. */
      transformIndexHtml(html) {
        if (mode !== 'development') {
          return html
        }
        // Main supplies the CSP with this document's resource origin and actual HMR port.
        return html.replace(/<meta\s+http-equiv="Content-Security-Policy"[^>]*>/i, '')
      },
    },
  ],
  server: { host: '127.0.0.1', port: 0 },
  build: {
    target: 'chrome156',
    rolldownOptions: {
      input: Object.fromEntries(
        ['main', 'reader', 'player', 'game-panel'].map((kind) => [
          kind,
          join(root, kind, 'index.html'),
        ]),
      ),
    },
  },
}))
