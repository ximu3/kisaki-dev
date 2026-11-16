/** @fileoverview Builds appearance tokens, bundled CSS values and the published stylesheets. */

import { defineLibrary } from '@kisaki3/config/vite/library'
import { assembleStyles } from './tools/styles'

export default defineLibrary({
  entries: {
    './tokens': './src/tokens.ts',
    './values': './src/values.ts',
    './defaults': './src/defaults.ts',
    './styles.css': './src/styles.css',
    './tailwind.css': './src/tailwind.css',
  },
  pack: {
    platform: 'browser',
    hooks: {
      /** Writes the published stylesheets after the token and value modules have been built. */
      'build:done': () => assembleStyles(),
    },
    deps: {
      alwaysBundle: ['css-tree'],
      onlyBundle: ['css-tree'],
    },
  },
})
