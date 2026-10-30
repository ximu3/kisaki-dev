/**
 * @fileoverview Checks workspace registration, publication boundaries and maintained
 * source typecheck coverage.
 */

import { expect, test } from 'vitest'
import { readFile, readdir } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import ts from 'typescript'
import { readPnpm } from '@kisaki3/tooling/process'

const root = process.cwd()

/** Enumerate maintained files only; historical probes and generated output have separate owners. */
async function sourceFiles(directory: string): Promise<string[]> {
  const ignored = new Set([
    '.git',
    'node_modules',
    'out',
    'dist',
    '.cache',
    '.local',
    '.vitest',
    '.turbo',
    'target',
    'test-results',
    'playwright-report',
    'coverage',
  ])
  const result: string[] = []

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) {
      continue
    }
    if (directory === root && ['refactor', 'artifacts'].includes(entry.name)) {
      continue
    }

    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      result.push(...(await sourceFiles(path)))
    } else {
      result.push(path)
    }
  }

  return result
}

/** Read registered project manifests through pnpm's workspace discovery. */
async function members(): Promise<{ directory: string; manifest: Record<string, unknown> }[]> {
  const selected = JSON.parse(
    await readPnpm(['list', '--recursive', '--depth', '-1', '--json'], root),
  ) as { path: string }[]

  const directories = selected
    .map((member) => relative(root, member.path).replaceAll('\\', '/'))
    .filter(Boolean)

  return Promise.all(
    directories.map(async (directory) => ({
      directory,
      manifest: JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')) as Record<
        string,
        unknown
      >,
    })),
  )
}

test('pnpm registers the maintained projects with unique identities and the intended publication boundaries', async () => {
  const projects = await members()
  const manifests = (await sourceFiles(root))
    .map((file) => relative(root, file).replaceAll('\\', '/'))
    .filter(
      (file) => file.endsWith('/package.json') && !/(^|\/)tests\/(?:[^/]+\/)*fixtures\//.test(file),
    )
    .map((file) => file.slice(0, -'/package.json'.length))

  expect(projects.map(({ directory }) => directory).sort()).toEqual(manifests.sort())
  expect(new Set(projects.map(({ manifest }) => manifest.name)).size).toBe(projects.length)

  for (const { directory, manifest } of projects) {
    expect(manifest.name).toMatch(/^@kisaki3\/[a-z][a-z0-9-]+$/)
    if (directory.startsWith('clients/desktop/packages/')) {
      expect(manifest.license).toBe('MIT')
      expect(manifest.publishConfig).toMatchObject({ access: 'public' })
    } else if (
      directory === 'clients/desktop/app' ||
      directory.startsWith('clients/desktop/extensions/projects/') ||
      ['packages/tooling', 'packages/typescript-config', 'packages/eslint-config'].includes(
        directory,
      )
    ) {
      expect(manifest.private).toBe(true)
      expect(manifest.license).toBe('AGPL-3.0-only')
    }

    if (directory.startsWith('clients/desktop/extensions/projects/')) {
      expect(manifest.name).toMatch(/^@kisaki3\/ext-/)
    }
  }
})

test('all maintained JavaScript-environment sources are TypeScript and have an executed typecheck owner', async () => {
  const files = await sourceFiles(root)
  expect(files.filter((path) => /\.(?:js|jsx|mjs|cjs)$/.test(path))).toEqual([])

  const projects = [
    {
      directory: '.',
      manifest: JSON.parse(await readFile('package.json', 'utf8')) as Record<string, unknown>,
    },
    ...(await members()),
  ]
  const configs: string[] = []

  for (const { directory, manifest } of projects) {
    const scripts = (manifest.scripts ?? {}) as Record<string, string>
    const command = directory === '.' ? scripts['root:typecheck'] : scripts.typecheck
    if (command) {
      configs.push(resolve(directory, 'tsconfig.json'))
    }
  }

  // This standalone project is typechecked after installation by the desktop consumer suite.
  configs.push(resolve('tests/desktop/fixtures/consumers/tsconfig.json'))

  const checked = new Set<string>()
  const checkedDeclarations = new Set<string>()
  const visited = new Set<string>()

  for (const config of configs) {
    if (visited.has(config)) {
      continue
    }
    visited.add(config)

    const content = ts.readConfigFile(config, ts.sys.readFile)
    expect(content.error, config).toBeUndefined()
    const parsed = ts.parseJsonConfigFileContent(content.config, ts.sys, resolve(config, '..'))
    expect(parsed.errors, config).toEqual([])
    expect(parsed.options.allowJs ?? false, config).toBe(false)
    for (const path of parsed.fileNames) {
      const file = resolve(path).toLowerCase()
      checked.add(file)
      if (!parsed.options.skipLibCheck) {
        checkedDeclarations.add(file)
      }
    }

    for (const reference of parsed.projectReferences ?? []) {
      configs.push(ts.resolveProjectReferencePath(reference))
    }
  }

  const uncovered = files.filter(
    (path) => /\.tsx?$/.test(path) && !checked.has(resolve(path).toLowerCase()),
  )
  expect(uncovered.map((path) => relative(root, path))).toEqual([])
  expect(
    files
      .filter(
        (path) => path.endsWith('.d.ts') && !checkedDeclarations.has(resolve(path).toLowerCase()),
      )
      .map((path) => relative(root, path)),
  ).toEqual([])
})
