import { defineLibrary } from '@kisaki3/config/vite/library'
import manifest from './package.json' with { type: 'json' }
import { defineConfig, mergeConfig } from 'vite-plus'
import { assembleStyles } from './tools/styles'

const library = defineLibrary({
  manifest,
  pack: {
    platform: 'browser',
    hooks: {
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
