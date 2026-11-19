/** @fileoverview Builds appearance tokens, bundled CSS values and the published stylesheets. */

import { defineLibrary } from '@kisaki3/config/vite/library'
import { defineConfig, mergeConfig } from 'vite-plus'
import { assembleStyles } from './tools/styles'

/** Builds the published JavaScript and stylesheets with the shared library tasks. */
const library = defineLibrary({
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

export default mergeConfig(
  library,
  defineConfig({
    run: {
      tasks: {
        'generate:styles': { command: 'vpx tools/styles.ts --generate', cache: false },
      },
    },
  }),
)
