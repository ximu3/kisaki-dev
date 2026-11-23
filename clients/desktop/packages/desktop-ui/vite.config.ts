import { defineLibrary } from '@kisaki3/config/vite/library'
import { transform } from '@solidjs/compiler'
import { assembleStyles } from './tools/styles'

export default defineLibrary({
  entries: {
    './alert': './src/components/alert/index.tsx',
    './badge': './src/components/badge/index.tsx',
    './button': './src/components/button/index.tsx',
    './chart': './src/components/chart/index.ts',
    './checkbox': './src/components/checkbox/index.tsx',
    './collapsible': './src/components/collapsible/index.tsx',
    './combobox': './src/components/combobox/index.tsx',
    './dialog': './src/components/dialog/index.tsx',
    './drag': './src/components/drag/index.ts',
    './empty-state': './src/components/empty-state/index.tsx',
    './field': './src/components/field/index.tsx',
    './form': './src/components/form/index.ts',
    './image': './src/components/image/index.tsx',
    './input': './src/components/input/index.ts',
    './link': './src/components/link/index.tsx',
    './list': './src/components/list/index.ts',
    './markdown': './src/components/markdown/index.ts',
    './menu': './src/components/menu/index.tsx',
    './popover': './src/components/popover/index.tsx',
    './progress': './src/components/progress/index.tsx',
    './radio-group': './src/components/radio-group/index.tsx',
    './scroll-area': './src/components/scroll-area/index.tsx',
    './segmented-control': './src/components/segmented-control/index.tsx',
    './select': './src/components/select/index.tsx',
    './separator': './src/components/separator/index.tsx',
    './slider': './src/components/slider/index.tsx',
    './spinner': './src/components/spinner/index.tsx',
    './switch': './src/components/switch/index.tsx',
    './table': './src/components/table/index.ts',
    './tabs': './src/components/tabs/index.tsx',
    './textarea': './src/components/textarea/index.tsx',
    './toast': './src/components/toast/index.ts',
    './toolbar': './src/components/toolbar/index.tsx',
    './tooltip': './src/components/tooltip/index.tsx',
    './virtualization': './src/components/virtualization/index.ts',
    './styles.css': './src/styles.css',
  },
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
