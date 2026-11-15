/** @fileoverview Builds public ESM, declarations and CSS as one public distribution. */

import { copyFile, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { build } from 'tsdown'
import { removeOutputs } from '@kisaki3/tooling/output'
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
 * Prepares the package's disposable dist directory and builds its public distribution.
 *
 * The caller consumes the output only after this operation succeeds.
 */
export async function buildPackage(signal?: AbortSignal): Promise<void> {
  const project = join(import.meta.dirname, '..')
  const outDir = join(project, 'dist')
  await removeOutputs(project, ['dist'], signal)

  await build({ cwd: project, outDir, clean: false })
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
  await runCli(buildPackage)
}
