import { defineLibrary } from '@kisaki3/config/vite/library'
import { defineConfig, mergeConfig } from 'vite-plus'
import { assembleStyles } from './tools/styles'

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
