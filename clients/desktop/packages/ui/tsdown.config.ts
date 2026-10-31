import { defineConfig } from 'tsdown'
import solid from 'unplugin-solid/rolldown'

export default defineConfig({
  tsconfig: './config/typescript/tsconfig.lib.json',
  entry: {
    index: 'src/index.ts',
    chart: 'src/chart.tsx',
    drag: 'src/drag.tsx',
    markdown: 'src/markdown.tsx',
  },
  format: ['esm'],
  dts: true,
  fixedExtension: false,
  clean: true,
  plugins: [solid()],
  // Components share the consumer's Solid runtime and reactive ownership.
  deps: {
    neverBundle: ['solid-js', 'solid-js/web'],
    // These upstream declarations use bundler-only paths; emit the types used by our public composition.
    dts: { alwaysBundle: [/^@kobalte\//, /^@unovis\//] },
  },
})
