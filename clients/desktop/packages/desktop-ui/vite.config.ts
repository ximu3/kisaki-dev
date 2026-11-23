/** @fileoverview Builds public Solid components, assembles their styles and selects real UI test hosts. */

import { defineLibrary } from '@kisaki3/config/vite/library'
import { transform } from '@solidjs/compiler'
import { assembleStyles } from './tools/styles'

export default defineLibrary({
  entries: {
    './alert': './src/components/alert/index.ts',
    './badge': './src/components/badge/index.ts',
    './button': './src/components/button/index.ts',
    './chart': './src/components/chart/index.ts',
    './checkbox': './src/components/checkbox/index.ts',
    './collapsible': './src/components/collapsible/index.ts',
    './combobox': './src/components/combobox/index.ts',
    './dialog': './src/components/dialog/index.ts',
    './drag': './src/components/drag/index.ts',
    './empty-state': './src/components/empty-state/index.ts',
    './field': './src/components/field/index.ts',
    './form': './src/components/form/index.ts',
    './image': './src/components/image/index.ts',
    './input': './src/components/input/index.ts',
    './link': './src/components/link/index.ts',
    './list': './src/components/list/index.ts',
    './markdown': './src/components/markdown/index.ts',
    './menu': './src/components/menu/index.ts',
    './popover': './src/components/popover/index.ts',
    './progress': './src/components/progress/index.ts',
    './radio-group': './src/components/radio-group/index.ts',
    './scroll-area': './src/components/scroll-area/index.ts',
    './segmented-control': './src/components/segmented-control/index.ts',
    './select': './src/components/select/index.ts',
    './separator': './src/components/separator/index.ts',
    './slider': './src/components/slider/index.ts',
    './spinner': './src/components/spinner/index.ts',
    './switch': './src/components/switch/index.ts',
    './table': './src/components/table/index.ts',
    './tabs': './src/components/tabs/index.ts',
    './textarea': './src/components/textarea/index.ts',
    './toast': './src/components/toast/index.ts',
    './toolbar': './src/components/toolbar/index.ts',
    './tooltip': './src/components/tooltip/index.ts',
    './virtualization': './src/components/virtualization/index.ts',
    './styles.css': './src/styles.css',
  },
  pack: {
    platform: 'browser',
    hooks: {
      /** Assembles the published stylesheet after the component build has emitted its CSS. */
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
