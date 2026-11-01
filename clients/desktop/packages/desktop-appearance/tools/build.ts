/** @fileoverview Builds public ESM, declarations and CSS as one complete candidate. */

import { copyFile, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { build } from 'tsdown'
import { replaceOutput } from '@kisaki3/tooling/output'
import { runCli } from '@kisaki3/tooling/cli'
import { defaults } from '../src/defaults'
import type { TokenValues } from '../src/tokens'

/** Serialize the maintained literal defaults; this is not an external CSS input boundary. */
function declarations(values: TokenValues): string {
  return Object.entries(values)
    .map(([name, value]) => `    ${name}: ${value};`)
    .join('\n')
}

/** Prepare all public outputs before replacing dist; cancellation before adoption preserves it. */
export async function buildPackage(signal?: AbortSignal): Promise<void> {
  const project = join(import.meta.dirname, '..')
  await replaceOutput(
    project,
    'dist',
    async (outDir) => {
      await build({ cwd: project, outDir })
      const styles = await readFile(join(project, 'src/styles.css'), 'utf8')
      const base = `/* Generated from defaults.ts; host font loading is separate. */
@layer theme {
  :root, [data-color-scheme='light'] {
    color-scheme: light;
${declarations(defaults.light)}
  }
  [data-color-scheme='dark'] {
    color-scheme: dark;
${declarations(defaults.dark)}
  }
}

`
      await writeFile(join(outDir, 'styles.css'), base + styles)
      await copyFile(join(project, 'src/tailwind.css'), join(outDir, 'tailwind.css'))

      // The value parser bundles CSS Tree and its grammar data; preserve their actual licenses.
      const require = createRequire(import.meta.url)
      const cssTree = require.resolve('css-tree/package.json')
      const dependencyRequire = createRequire(cssTree)
      const notices = []
      for (const manifest of [
        cssTree,
        dependencyRequire.resolve('mdn-data/package.json'),
        dependencyRequire.resolve('source-map-js/package.json'),
      ]) {
        const { name, version } = JSON.parse(await readFile(manifest, 'utf8')) as {
          name: string
          version: string
        }
        notices.push(
          `${name} ${version}\n\n${await readFile(join(dirname(manifest), 'LICENSE'), 'utf8')}`,
        )
      }
      await writeFile(join(outDir, 'THIRD-PARTY-NOTICES.txt'), notices.join('\n\n---\n\n'))
    },
    signal,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runCli(buildPackage)
}
