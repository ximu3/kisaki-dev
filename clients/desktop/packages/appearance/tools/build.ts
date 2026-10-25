import { build } from 'tsdown'
import type * as DefaultTokens from '../src/defaults'
import { writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { replaceOutput } from '@repo-tools/output'
import { runCli } from '@repo-tools/cli'

const root = fileURLToPath(new URL('..', import.meta.url))

/** Build code, declarations and generated styles before replacing the owned package output. */
export async function buildPackage(signal?: AbortSignal): Promise<void> {
  await replaceOutput(
    root,
    'dist',
    async (candidate) => {
      await build({ config: join(root, 'tsdown.config.ts'), outDir: candidate, clean: true })
      const defaults: typeof DefaultTokens = await import(
        pathToFileURL(join(candidate, 'index.js')).href
      )
      const light = cssTokens(':root', defaults.defaultLightTokens)
      const dark = cssTokens(":root[data-color-scheme='dark']", defaults.defaultDarkTokens)
      await writeFile(join(candidate, 'styles.css'), light + '\n\n' + dark + '\n')
    },
    signal,
  )
}

function cssTokens(selector: string, values: Readonly<Record<string, string>>): string {
  const declarations = Object.entries(values).map(([name, value]) => `  ${name}: ${value};`)
  return `${selector} {\n${declarations.join('\n')}\n}`
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runCli((signal) => buildPackage(signal))
}
