import { copyFile, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { runCli } from '@kisaki3/tooling/cli'
import { defaults } from '../src/defaults'

const sourceDirectory = join(import.meta.dirname, '../src')
const defaultsFile = join(sourceDirectory, 'defaults.generated.css')
const outputDirectory = join(import.meta.dirname, '../dist')

function renderDefaultsStylesheet(): string {
  const schemes = Object.entries(defaults).map(([scheme, values]) => {
    const selector = `[data-color-scheme='${scheme}']`
    const scope = scheme === 'light' ? `:root, ${selector}` : selector
    const declarations = Object.entries(values).map(([name, value]) => `    ${name}: ${value};`)
    return [`  ${scope} {`, `    color-scheme: ${scheme};`, ...declarations, '  }'].join('\n')
  })

  return ['/* Generated from defaults.ts. */', '@layer theme {', ...schemes, '}', ''].join('\n')
}

async function writeDefaultsStylesheet(signal: AbortSignal): Promise<void> {
  const stylesheet = renderDefaultsStylesheet()
  signal.throwIfAborted()
  await writeFile(defaultsFile, stylesheet)
}

async function assembleStylesheets(): Promise<void> {
  const defaultsCss = await readFile(defaultsFile, 'utf8')
  if (defaultsCss !== renderDefaultsStylesheet()) {
    throw new Error('Refresh the default stylesheet with generate:styles')
  }

  const styles = await readFile(join(sourceDirectory, 'styles.css'), 'utf8')
  await writeFile(
    join(outputDirectory, 'styles.css'),
    styles.replace("@import './defaults.generated.css';", defaultsCss.trimEnd()),
  )
  await copyFile(join(sourceDirectory, 'tailwind.css'), join(outputDirectory, 'tailwind.css'))
}

async function writeLicenseNotices(): Promise<void> {
  // The value parser bundles CSS Tree and its grammar data; preserve their actual licenses.
  const cssTreeManifest = createRequire(import.meta.url).resolve('css-tree/package.json')
  const resolveCssTreeDependency = createRequire(cssTreeManifest).resolve
  const notices = []
  for (const manifest of [
    cssTreeManifest,
    resolveCssTreeDependency('mdn-data/package.json'),
    resolveCssTreeDependency('source-map-js/package.json'),
  ]) {
    const { name, version } = JSON.parse(await readFile(manifest, 'utf8')) as {
      name: string
      version: string
    }
    notices.push(
      `${name} ${version}\n\n${await readFile(join(dirname(manifest), 'LICENSE'), 'utf8')}`,
    )
  }
  await writeFile(join(outputDirectory, 'THIRD-PARTY-NOTICES.txt'), notices.join('\n\n---\n\n'))
}

export async function assembleStyles(signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted()
  await assembleStylesheets()
  await writeLicenseNotices()
  signal?.throwIfAborted()
}

if (import.meta.main) {
  await runCli(process.argv.includes('--generate') ? writeDefaultsStylesheet : assembleStyles)
}
