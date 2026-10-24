import { build } from 'tsdown'
import type * as DefaultTokens from '../src/defaults'
import { mkdir, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

/** Build code, declarations and assets in a candidate, then replace the package output. */
export async function buildPackage(): Promise<void> {
  const cache = join(root, '.cache')
  await mkdir(cache, { recursive: true })
  const lock = join(cache, 'build.lock')
  await mkdir(lock)
  let candidate: string | undefined
  const output = join(root, 'dist')
  let replaced = false

  try {
    candidate = await mkdtemp(join(cache, 'build-'))
    const previous = candidate + '.previous'
    await build({ config: join(root, 'tsdown.config.ts'), outDir: candidate, clean: true })

    const defaults: typeof DefaultTokens = await import(
      pathToFileURL(join(candidate, 'index.js')).href
    )
    const light = cssTokens(':root', defaults.defaultLightTokens)
    const dark = cssTokens(":root[data-color-scheme='dark']", defaults.defaultDarkTokens)
    await writeFile(join(candidate, 'styles.css'), `${light}\n\n${dark}\n`)

    try {
      await stat(output)
      await rename(output, previous)
      replaced = true
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause
    }

    try {
      await rename(candidate, output)
    } catch (cause) {
      if (replaced) await rename(previous, output)
      throw cause
    }

    await rm(previous, { recursive: true, force: true })
  } finally {
    if (candidate) await rm(candidate, { recursive: true, force: true })
    await rm(lock, { recursive: true, force: true })
  }
}

function cssTokens(selector: string, values: Readonly<Record<string, string>>): string {
  const declarations = Object.entries(values).map(([name, value]) => `  ${name}: ${value};`)
  return `${selector} {\n${declarations.join('\n')}\n}`
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await buildPackage()
  } catch (cause) {
    console.error(cause)
    process.exitCode = 1
  }
}
