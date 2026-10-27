import { expect, test } from 'vitest'
import { readFile, readdir } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import ts from 'typescript'
import { readPnpm } from '@kisaki3/tooling/process'

const root = process.cwd()

/** Enumerate maintained files only; historical probes and generated output have separate owners. */
async function sourceFiles(directory: string): Promise<string[]> {
  const ignored = new Set([
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
  ])
  const result: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...(await sourceFiles(path)))
    else result.push(path)
  }
  return result
}

/** Read the actual member manifests; category folders and fixture projects are not members. */
async function members(): Promise<{ directory: string; manifest: Record<string, unknown> }[]> {
  const directories = ['clients/desktop/app']
  for (const parent of [
    'packages',
    'clients/desktop/packages',
    'clients/desktop/extensions/projects',
  ]) {
    for (const child of await readdir(parent, { withFileTypes: true })) {
      if (child.isDirectory()) directories.push(`${parent}/${child.name}`)
    }
  }
  return Promise.all(
    directories.map(async (directory) => ({
      directory,
      manifest: JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')),
    })),
  )
}

test('pnpm registers the maintained projects with unique identities and the intended publication boundaries', async () => {
  const selected: { path: string }[] = JSON.parse(
    await readPnpm(['list', '--recursive', '--depth', '-1', '--json'], root),
  )
  const projects = await members()
  const actual = selected.map((member) => relative(root, member.path).replaceAll('\\', '/'))
  expect(actual.filter(Boolean).sort()).toEqual(projects.map(({ directory }) => directory).sort())
  expect(new Set(projects.map(({ manifest }) => manifest.name)).size).toBe(projects.length)
  for (const { directory, manifest } of projects) {
    expect(manifest.name).toMatch(/^@kisaki3\/[a-z][a-z0-9-]+$/)
    if (directory.startsWith('clients/desktop/packages/')) {
      expect(manifest.license).toBe('MIT')
      expect(manifest.publishConfig).toMatchObject({ access: 'public' })
    } else {
      expect(manifest.private).toBe(true)
      expect(manifest.license).toBe('AGPL-3.0-only')
    }
    if (directory.includes('/extensions/')) expect(manifest.name).toMatch(/^@kisaki3\/ext-/)
  }
})

test('all maintained JavaScript-environment sources are TypeScript and have an executed typecheck owner', async () => {
  const rootFiles = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => join(root, entry.name))
  const files = [
    ...rootFiles,
    ...(
      await Promise.all(
        ['clients', 'packages', 'config', 'tools', 'tests'].map((directory) =>
          sourceFiles(resolve(directory)),
        ),
      )
    ).flat(),
  ]
  expect(files.filter((path) => /\.(?:js|jsx|mjs|cjs)$/.test(path))).toEqual([])
  const projects = [
    { directory: '.', manifest: JSON.parse(await readFile('package.json', 'utf8')) },
    ...(await members()),
  ]
  const configs: string[] = []
  for (const { directory, manifest } of projects) {
    const scripts = (manifest.scripts ?? {}) as Record<string, string>
    const command = directory === '.' ? scripts['typecheck:root'] : scripts.typecheck
    for (const match of (command ?? '').matchAll(
      /tsc (?:-p|--project|-b|--build)(?: ([\w./-]+\.json))?/g,
    )) {
      configs.push(resolve(directory, match[1] ?? 'tsconfig.json'))
    }
  }
  configs.push(
    ...[
      'node/tsconfig.json',
      'webview/tsconfig.json',
      'solid/tsconfig.json',
      'config/typescript/tsconfig.tools.json',
    ].map((file) => resolve('tests/fixtures/consumers', file)),
  )
  const checked = new Set<string>()
  const checkedDeclarations = new Set<string>()
  const visited = new Set<string>()
  for (const config of configs) {
    if (visited.has(config)) continue
    visited.add(config)

    const content = ts.readConfigFile(config, ts.sys.readFile)
    expect(content.error, config).toBeUndefined()
    const parsed = ts.parseJsonConfigFileContent(content.config, ts.sys, resolve(config, '..'))
    expect(parsed.errors, config).toEqual([])
    expect(parsed.options.allowJs ?? false, config).toBe(false)
    for (const path of parsed.fileNames) {
      const file = resolve(path).toLowerCase()
      checked.add(file)
      if (!parsed.options.skipLibCheck) checkedDeclarations.add(file)
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
