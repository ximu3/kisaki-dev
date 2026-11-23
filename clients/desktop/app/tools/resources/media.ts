import { createRequire } from 'node:module'
import { cp, mkdir, readFile, realpath } from 'node:fs/promises'
import { dirname, join, basename } from 'node:path'
import { existsSync } from 'node:fs'
import { appRoot } from '../lib/paths'

/** Copies required package bytes and only the native optional dependencies for the target host. */
export async function copyMediaRuntime(destination: string) {
  const packages = new Map<string, string>()
  const platform = process.platform + '-' + process.arch
  /** Resolves each dependency from its importing package, including non-exported manifests. */
  async function copyPackage(name: string, from: string) {
    const require = createRequire(join(from, 'package.json'))
    const path = require.resolve
      .paths(name)
      ?.map((root) => join(root, name))
      .find((dir) => existsSync(join(dir, 'package.json')))
    if (!path) {
      throw new Error('Missing image runtime dependency ' + name)
    }
    const source = await realpath(path)
    if (packages.has(name)) {
      if (packages.get(name) !== source) {
        throw new Error('Conflicting image runtime dependency ' + name)
      }
      return
    }
    packages.set(name, source)
    const output = join(destination, 'node_modules', name)
    await mkdir(dirname(output), { recursive: true })
    await cp(source, output, {
      recursive: true,
      filter: (path) => basename(path) !== 'node_modules',
    })
    const manifest = JSON.parse(await readFile(join(source, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      optionalDependencies?: Record<string, string>
    }
    const native = Object.keys(manifest.optionalDependencies ?? {}).filter(
      (dep) => dep === '@img/sharp-' + platform || dep === '@img/sharp-libvips-' + platform,
    )
    for (const dependency of [...Object.keys(manifest.dependencies ?? {}), ...native]) {
      await copyPackage(dependency, source)
    }
  }
  await copyPackage('sharp', appRoot)
  await copyPackage('fontkit', appRoot)
}
