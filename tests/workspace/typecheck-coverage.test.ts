/** @fileoverview Checks source language and typecheck coverage for maintained code and declarations. */

import { expect, test } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import ts from 'typescript'
import { maintainedFiles, workspaceMembers } from '../support/workspace'

/** Workspace root whose maintained sources and executed typecheck owners are compared. */
const root = process.cwd()

test('all maintained JavaScript-environment sources are TypeScript and have an executed typecheck owner', async () => {
  const files = await maintainedFiles(root)
  expect(files.filter((path) => /\.(?:js|jsx|mjs|cjs)$/.test(path))).toEqual([])

  const projects = [
    {
      directory: '.',
      manifest: JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as Record<
        string,
        unknown
      >,
    },
    ...(await workspaceMembers(root)),
  ]
  const configs: string[] = []

  for (const { directory, manifest } of projects) {
    const scripts = (manifest.scripts ?? {}) as Record<string, string>
    const command = directory === '.' ? scripts['root:typecheck'] : scripts.typecheck
    if (command) {
      configs.push(resolve(root, directory, 'tsconfig.json'))
    }
    // Consumer tasks check their own fixture projects after installing the actual tarballs.
    if (scripts['test:consumers']) {
      configs.push(
        ...files.filter((file) => {
          const name = relative(resolve(root, directory), file).replaceAll('\\', '/')
          return name.startsWith('tests/fixtures/consumers/') && name.endsWith('/tsconfig.json')
        }),
      )
    }
  }

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
