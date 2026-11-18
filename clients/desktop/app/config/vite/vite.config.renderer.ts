/** @fileoverview Builds all native Solid documents and grants the local development server its HMR connection. */

import { defineConfig, normalizePath } from 'vite'
import solid from 'vite-plugin-solid'
import tailwind from '@tailwindcss/vite'
import { findPackageJSON } from 'node:module'
import { readFileSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/** Root of the native document entry pages. */
const root = fileURLToPath(new URL('../../src/renderer/windows', import.meta.url))

/** Makes Tailwind's CSS resolver honor the workspace source exports while serving the renderer. */
function sourceStyleAliases() {
  return ['@kisaki3/desktop-ui', '@kisaki3/desktop-appearance'].flatMap((name) => {
    const manifestPath = findPackageJSON(name, import.meta.url)!
    const { exports } = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      exports: Record<string, { 'kisaki-source'?: string }>
    }

    return Object.entries(exports).flatMap(([key, entry]) => {
      const source = entry['kisaki-source']
      return key.endsWith('.css') && source
        ? [
            {
              find: name + key.slice(1),
              replacement: normalizePath(realpathSync(join(dirname(manifestPath), source))),
            },
          ]
        : []
    })
  })
}

export default defineConfig(({ command, mode }) => ({
  root,
  base: './',
  ...(command === 'serve' && { resolve: { alias: sourceStyleAliases() } }),
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
