/**
 * @fileoverview Exercises Vite resolution and adoption of complete public-package
 * snapshots, including failed preparation and obsolete-copy cleanup.
 */

import { expect, onTestFinished, test } from 'vitest'
import { mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { appRoot } from '../../tools/lib/paths'
import { captureDependencies } from '../../tools/dev/dependencies'
import { createRequire } from 'node:module'
import { startRenderer } from '../../tools/dev/renderer'

test('Vite resolves complete snapshots and accepts environment-specific exports and releases obsolete copies', async () => {
  const parent = join(appRoot, '.local')
  await mkdir(parent, { recursive: true })
  const directory = await mkdtemp(join(parent, 'dependency-snapshot-test-'))
  onTestFinished(() => rm(directory, { recursive: true, force: true }))
  const packageRoot = join(directory, 'package')
  const snapshotsRoot = join(directory, 'snapshots')
  const name = '@kisaki3/snapshot-fixture'
  await mkdir(join(packageRoot, 'dist'), { recursive: true })
  const manifest = {
    name,
    type: 'module',
    dependencies: { 'snapshot-dependency': '1.0.0' },
    exports: {
      '.': {
        browser: { development: './dist/development.js', default: './dist/browser.js' },
        node: './dist/node.js',
      },
      './styles.css': './dist/styles.css',
      './node-only': { node: './dist/node.js' },
    },
  }
  await writeFile(join(packageRoot, 'package.json'), JSON.stringify(manifest))
  await writeFile(join(packageRoot, 'dist/development.js'), "export const value = 'first'\n")
  await writeFile(join(packageRoot, 'dist/browser.js'), "export const value = 'browser'\n")
  await writeFile(join(packageRoot, 'dist/node.js'), "export const value = 'node'\n")
  await writeFile(join(packageRoot, 'dist/styles.css'), ':root { --fixture: 1 }\n')

  const dependency = join(packageRoot, 'node_modules/snapshot-dependency')
  await mkdir(dependency, { recursive: true })
  await writeFile(
    join(dependency, 'package.json'),
    JSON.stringify({ name: 'snapshot-dependency', type: 'module', exports: './index.js' }),
  )
  await writeFile(join(dependency, 'index.js'), "export const value = 'installed dependency'\n")

  const members = [{ name, path: packageRoot }]
  const renderer = await startRenderer(
    join(appRoot, 'tests/fixtures/runtime'),
    members,
    snapshotsRoot,
  )
  onTestFinished(() => renderer.close())

  const first = await captureDependencies(members, snapshotsRoot)
  await renderer.adopt(first)

  const firstPackage = first.packages.get(name)!
  const initial = await renderer.resolveDependency(name, join(appRoot, 'package.json'))
  expect(resolve(initial!.id.replace(/[?#].*$/, ''))).toBe(
    join(firstPackage, 'dist/development.js'),
  )

  const installed = await renderer.resolveDependency(
    'snapshot-dependency',
    join(firstPackage, 'dist/development.js'),
  )
  const originalInstalled = await renderer.resolveDependency(
    'snapshot-dependency',
    join(packageRoot, 'package.json'),
  )
  expect(installed).not.toBeNull()
  expect(installed?.id).toBe(originalInstalled?.id)

  const stylesheet = await renderer.resolveDependency(
    `${name}/styles.css?inline`,
    join(appRoot, 'package.json'),
  )
  expect(new URLSearchParams(stylesheet!.id.split('?')[1]).has('inline')).toBe(true)

  expect(createRequire(join(packageRoot, 'package.json')).resolve(`${name}/node-only`)).toBe(
    join(packageRoot, 'dist/node.js'),
  )

  await rename(join(packageRoot, 'dist'), join(packageRoot, 'held-dist'))
  await expect(captureDependencies(members, snapshotsRoot)).rejects.toThrow()
  expect(await readdir(snapshotsRoot)).toEqual([basename(first.directory)])
  await rename(join(packageRoot, 'held-dist'), join(packageRoot, 'dist'))

  const retained = await renderer.resolveDependency(name, join(appRoot, 'package.json'))
  expect(resolve(retained!.id.replace(/[?#].*$/, ''))).toBe(
    join(firstPackage, 'dist/development.js'),
  )

  await writeFile(join(packageRoot, 'package.json'), JSON.stringify(manifest))
  await writeFile(join(packageRoot, 'dist/development.js'), "export const value = 'second'\n")

  const second = await captureDependencies(members, snapshotsRoot)
  await renderer.adopt(second)

  const adopted = await renderer.resolveDependency(name, join(appRoot, 'package.json'))
  expect(resolve(adopted!.id.replace(/[?#].*$/, ''))).toBe(
    join(second.packages.get(name)!, 'dist/development.js'),
  )

  await expect(stat(first.directory)).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await readFile(join(second.packages.get(name)!, 'dist/development.js'), 'utf8')).toContain(
    'second',
  )

  const unchanged = await captureDependencies(members, snapshotsRoot)
  await renderer.adopt(unchanged)
  expect(await readdir(snapshotsRoot)).toEqual([basename(second.directory)])
})
