import { readdirSync } from 'node:fs'
import { defineConfig } from 'tsdown'
import solid from 'unplugin-solid/rolldown'

export default defineConfig({
  entry: Object.fromEntries(
    readdirSync('src/components').map((name) => [name, `src/components/${name}/index.ts`]),
  ),
  tsconfig: 'config/typescript/tsconfig.lib.json',
  platform: 'browser',
  target: 'es2023',
  format: 'esm',
  dts: true,
  deps: {
    onlyBundle: ['@unovis/solid', '@unovis/ts'],
    dts: { alwaysBundle: ['@unovis/solid', '@unovis/ts'] },
  },
  plugins: [solid()],
  css: { fileName: 'components.css', modules: { generateScopedName: 'kui_[hash]_[local]' } },
})
