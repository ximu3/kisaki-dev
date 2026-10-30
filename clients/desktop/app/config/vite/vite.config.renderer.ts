/**
 * @fileoverview Builds the four Solid window documents and configures their loopback
 * development server and development CSP.
 */

import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = fileURLToPath(new URL('../../src/renderer/windows', import.meta.url))

export default defineConfig(({ mode }) => ({
  root,
  base: './',
  plugins: [
    solid(),
    {
      name: 'desktop-development-csp',
      transformIndexHtml(html) {
        if (mode !== 'development') {
          return html
        }

        return html
          .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
          .replace("connect-src 'self'", "connect-src 'self' ws://127.0.0.1:*")
      },
    },
  ],
  server: { host: '127.0.0.1', port: 0, strictPort: false },
  build: {
    target: 'chrome156',
    rolldownOptions: {
      input: {
        main: resolve(root, 'main/index.html'),
        reader: resolve(root, 'reader/index.html'),
        player: resolve(root, 'player/index.html'),
        'game-panel': resolve(root, 'game-panel/index.html'),
      },
    },
  },
}))
