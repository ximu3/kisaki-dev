import { existsSync } from 'node:fs'
import { defineConfig } from 'tsdown'
import solid from 'unplugin-solid/rolldown'
import manifest from './package.json'

export default defineConfig({
  entry: Object.fromEntries(
    Object.keys(manifest.exports)
      .filter((path) => !path.endsWith('.css'))
      .map((path) => {
        const name = path.slice(2)
        return [
          name,
          existsSync(`src/${name}/index.ts`) ? `src/${name}/index.ts` : `src/${name}.tsx`,
        ]
      }),
  ),
  tsconfig: 'config/typescript/tsconfig.lib.json',
  platform: 'browser',
  target: 'es2023',
  format: 'esm',
  fixedExtension: false,
  plugins: [solid()],
  deps: { dts: { alwaysBundle: [/^@unovis\/(solid|ts)(\/|$)/] } },
  dts: true,
})
