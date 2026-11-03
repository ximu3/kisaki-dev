/** @fileoverview Checks workspace registration and unique project identities. */

import { expect, test } from 'vitest'
import { relative } from 'node:path'
import { maintainedFiles, workspaceMembers } from '../support/workspace'

const root = process.cwd()

test('all maintained packages are registered with unique workspace identities', async () => {
  const projects = await workspaceMembers(root)
  const manifests = (await maintainedFiles(root))
    .map((file) => relative(root, file).replaceAll('\\', '/'))
    .filter(
      (file) => file.endsWith('/package.json') && !/(^|\/)tests\/(?:[^/]+\/)*fixtures\//.test(file),
    )
    .map((file) => file.slice(0, -'/package.json'.length))

  expect(projects.map(({ directory }) => directory).sort()).toEqual(manifests.sort())
  expect(new Set(projects.map(({ manifest }) => manifest.name)).size).toBe(projects.length)
})
