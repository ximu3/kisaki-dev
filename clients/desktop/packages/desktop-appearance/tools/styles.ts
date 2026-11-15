/** @fileoverview Assembles appearance styles and third-party notices for the published package. */

import { copyFile, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { runCli } from '@kisaki3/tooling/cli'
import { defaults } from '../src/defaults'
import type { TokenValues } from '../src/tokens'

/** Serializes the package's authored token values as CSS custom-property declarations. */
function declarations(values: TokenValues): string {
  return Object.entries(values)
    .map(([name, value]) => `    ${name}: ${value};`)
    .join('\n')
}

/**
 * Assembles the source styles and third-party notices into the completed package output.
 *
 * The caller consumes the output only after this operation succeeds.
 */
export async function assembleStyles(signal?: AbortSignal, generate = false): Promise<void> {
  const project = join(import.meta.dirname, '..')
  const outDir = join(project, 'dist')
  signal?.throwIfAborted()
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
  const generated = base.trimEnd() + '\n'
  const defaultsFile = join(project, 'src/defaults.generated.css')
  if (generate) {
    await writeFile(defaultsFile, generated)
    return
  }
  if ((await readFile(defaultsFile, 'utf8')) !== generated) {
    throw new Error('Refresh the default stylesheet with generate:styles')
  }
  await writeFile(
    join(outDir, 'styles.css'),
    styles.replace("@import './defaults.generated.css';", base.trimEnd()),
  )
  await copyFile(join(project, 'src/tailwind.css'), join(outDir, 'tailwind.css'))

  // The value parser bundles CSS Tree and its grammar data; preserve their actual licenses.
  /** Resolves the installed CSS parser from this package's build environment. */
  const require = createRequire(import.meta.url)
  const cssTree = require.resolve('css-tree/package.json')
  /** Resolves the CSS parser's data and license dependencies relative to their owner. */
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

  signal?.throwIfAborted()
}

if (import.meta.main) {
  await runCli((signal) => assembleStyles(signal, process.argv.includes('--generate')))
}
