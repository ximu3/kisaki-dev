import { defineLibrary } from '@kisaki3/config/vite/library'
import manifest from './package.json' with { type: 'json' }
import { transform } from '@solidjs/compiler'
import { assembleStyles } from './tools/styles'

export default defineLibrary({
  manifest,
  pack: {
    platform: 'browser',
    hooks: {
      'build:done': () => assembleStyles(),
    },
    plugins: [
      {
        name: 'solid',
        transform: {
          filter: { id: /\.tsx$/ },
          handler(code, filename) {
            const result = transform(code, { filename, sourceMap: true })
            return { code: result.code, map: result.map ?? null }
          },
        },
      },
    ],
    deps: {
      onlyBundle: ['@unovis/ts'],
      dts: { alwaysBundle: ['@unovis/ts'] },
    },
    css: { fileName: 'components.css', modules: { generateScopedName: 'kui_[hash]_[local]' } },
  },
  browserTests: true,
  consumerHookTimeout: 180_000,
})
