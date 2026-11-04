import { existsSync } from 'node:fs'
import { defineConfig } from 'tsdown'
import manifest from './package.json'

export default defineConfig({
  entry: Object.fromEntries(
    Object.keys(manifest.exports).map((path) => {
      const name = path.slice(2)
      return [name, existsSync(`src/${name}/index.ts`) ? `src/${name}/index.ts` : `src/${name}.ts`]
    }),
  ),

  tsconfig: 'config/typescript/tsconfig.lib.json',
  target: 'es2023',
  format: 'esm',
  fixedExtension: false,
  dts: true,
})
