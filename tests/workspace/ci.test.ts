/** @fileoverview Verifies project-level selection, independent feedback and host-specific diagnostics. */

import { expect, test } from 'vite-plus/test'
import { workspaceVerification } from '../../tools/ci/groups'
import type { VerificationGroup } from '../../tools/ci/groups'
import { planChecks } from '../../tools/ci/plan'

/** Actual projects, dependencies and verification groups from this checkout. */
const verification = workspaceVerification()

test('documentation alone needs no host; an independent library runs the whole public group', () => {
  const docs = planChecks(['refactor/README.md', 'AGENTS.md'], verification)
  expect(docs.code).toBe(false)
  expect(docs.matrix).toEqual([])

  const changes = planChecks(
    ['refactor/README.md', 'clients/desktop/packages/desktop-rpc/src/frames.test.ts'],
    verification,
  )
  expect(changes.matrix.map((row) => row.label)).toEqual(['public packages · linux-x64'])
  expect(changes.matrix[0]!.tasks).toContain('@kisaki3/desktop-ui#verify')
})

test('desktop dependencies, shared inputs and deletions select all six desktop hosts', () => {
  for (const paths of [
    [
      'clients/desktop/packages/desktop-appearance/src/styles.css',
      'clients/desktop/packages/desktop-rpc/package.json',
    ],
    ['clients/desktop/app/release-notes/next/en.md'],
    ['pnpm-lock.yaml'],
    ['clients/desktop/packages/removed/package.json'],
    undefined,
  ]) {
    const { matrix } = planChecks(paths, verification)
    const desktop = matrix.filter((row) => row.group === 'desktop')
    expect(new Set(desktop.map((row) => row.target)).size).toBe(6)
    expect(desktop.every((row) => row.tasks.includes('@kisaki3/desktop#verify'))).toBe(true)
    expect(
      matrix.filter((row) => row.group === 'public packages').map((row) => row.target),
    ).toEqual(['linux-x64'])
  }
})

test('another delivery group verifies its own project and joins changes to its dependency', () => {
  const service = { name: '@fixture/service', directory: 'service' }
  const group: VerificationGroup = {
    name: 'service',
    members: [service],
    inputs: ['@kisaki3/desktop-rpc'],
    targets: { 'linux-x64': 'ubuntu-24.04' },
    /** Runs the sample project through its declared entry. */
    verify: () => ({ tasks: [service.name + '#verify'] }),
  }
  const workspace = [...verification.workspace, service]
  const groups = [...verification.groups, group]

  expect(
    planChecks(['service/package.json'], { workspace, groups }).matrix.map((row) => row.tasks),
  ).toEqual([['@fixture/service#verify']])
  expect(
    planChecks(['clients/desktop/packages/desktop-rpc/package.json'], {
      workspace,
      groups,
    }).matrix.map((row) => row.group),
  ).toEqual(['public packages', 'service'])
  expect(() =>
    planChecks(['service/package.json'], { workspace, groups: verification.groups }),
  ).toThrow(service.name)
  expect(
    planChecks(undefined, { workspace, groups }, 'all', 'service').matrix.map((row) => row.label),
  ).toEqual(['service · linux-x64'])
})

test('manual performance checks run only the requested suite on one or all hosts', () => {
  const single = planChecks(undefined, verification, 'macos-x64', 'performance')
  expect(single.matrix.map(({ target, tasks }) => [target, tasks])).toEqual([
    ['macos-x64', ['@kisaki3/desktop#test:performance']],
  ])
  const all = planChecks(undefined, verification, 'all', 'performance')
  expect(all.matrix).toHaveLength(6)
  expect(all.matrix.every((row) => row.tasks.length === 1 && row.performanceReport)).toBe(true)
})
