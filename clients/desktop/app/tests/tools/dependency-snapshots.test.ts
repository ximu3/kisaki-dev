import { expect, test } from 'vitest'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { appRoot } from '../../tools/lib/paths'
import { captureDependencies } from '../../tools/dev/dependencies'
import type { DependencySnapshot } from '../../tools/dev/dependencies'
import { startRenderer } from '../../tools/dev/renderer'

test('Vite resolves complete snapshots and preserves the active generation after a failed export', async () => {
  const parent = join(appRoot, '.local')
  await mkdir(parent, { recursive: true })
  const directory = await mkdtemp(join(parent, 'dependency-snapshot-test-'))
  const packageRoot = join(directory, 'package')
  const snapshotsRoot = join(directory, 'snapshots')
  const name = '@kisaki3/snapshot-fixture'
  let renderer: Awaited<ReturnType<typeof startRenderer>> | undefined
  try {
    await mkdir(join(packageRoot, 'dist'), { recursive: true })
    const manifest = {
      name,
      type: 'module',
      exports: {
        '.': {
          browser: { development: './dist/development.js', default: './dist/browser.js' },
          node: './dist/node.js',
        },
        './styles.css': './dist/styles.css',
      },
    }
    await writeFile(join(packageRoot, 'package.json'), JSON.stringify(manifest))
    await writeFile(join(packageRoot, 'dist/development.js'), "export const value = 'first'\n")
    await writeFile(join(packageRoot, 'dist/browser.js'), "export const value = 'browser'\n")
    await writeFile(join(packageRoot, 'dist/node.js'), "export const value = 'node'\n")
    await writeFile(join(packageRoot, 'dist/styles.css'), ':root { --fixture: 1 }\n')
    const members = [{ name, path: packageRoot }]
    const snapshots = new Map<string, DependencySnapshot>()
    renderer = await startRenderer(members, snapshotsRoot)

    const first = await captureDependencies(
      members,
      snapshotsRoot,
      snapshots,
      renderer.resolveDependency,
    )
    await renderer.adopt(first)
    const firstPackage = first.packages.get(name)!
    const initial = await renderer.resolveDependency(name, join(appRoot, 'package.json'))
    expect(resolve(initial!.id.replace(/[?#].*$/, ''))).toBe(
      join(firstPackage, 'dist/development.js'),
    )
    const stylesheet = await renderer.resolveDependency(
      `${name}/styles.css?inline`,
      join(appRoot, 'package.json'),
    )
    expect(new URLSearchParams(stylesheet!.id.split('?')[1]).has('inline')).toBe(true)

    await writeFile(
      join(packageRoot, 'package.json'),
      JSON.stringify({ ...manifest, exports: { '.': './dist/missing.js' } }),
    )
    await expect(
      captureDependencies(members, snapshotsRoot, snapshots, renderer.resolveDependency),
    ).rejects.toThrow()
    expect([...snapshots.keys()]).toEqual([first.id])
    expect(await readdir(snapshotsRoot)).toEqual([first.id])
    const retained = await renderer.resolveDependency(name, join(appRoot, 'package.json'))
    expect(resolve(retained!.id.replace(/[?#].*$/, ''))).toBe(
      join(firstPackage, 'dist/development.js'),
    )

    await writeFile(join(packageRoot, 'package.json'), JSON.stringify(manifest))
    await writeFile(join(packageRoot, 'dist/development.js'), "export const value = 'second'\n")
    const second = await captureDependencies(
      members,
      snapshotsRoot,
      snapshots,
      renderer.resolveDependency,
    )
    await renderer.adopt(second)
    const adopted = await renderer.resolveDependency(name, join(appRoot, 'package.json'))
    expect(resolve(adopted!.id.replace(/[?#].*$/, ''))).toBe(
      join(second.packages.get(name)!, 'dist/development.js'),
    )
    const previousImport = await renderer.resolveDependency(
      name,
      join(firstPackage, 'dist/development.js'),
    )
    expect(resolve(previousImport!.id.replace(/[?#].*$/, ''))).toBe(
      join(firstPackage, 'dist/development.js'),
    )
    expect(await readFile(join(firstPackage, 'dist/development.js'), 'utf8')).toContain('first')
  } finally {
    await renderer?.close()
    await rm(directory, { recursive: true, force: true })
  }
})
