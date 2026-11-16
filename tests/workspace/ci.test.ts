/** @fileoverview Verifies automatic project coverage and explicit target or suite selection. */

import { expect, test } from 'vite-plus/test'
import { planChecks, verificationProjects } from '../../tools/ci/plan'

/** Actual project membership and downstream reach from this checkout's locked pnpm. */
const projects = verificationProjects()

test('documentation alone needs no host; an independent library runs the Linux public checks', () => {
  const docs = planChecks(['refactor/README.md', 'AGENTS.md'], projects)
  expect(docs.code).toBe(false)
  expect(docs.matrix).toEqual([])

  const changes = planChecks(
    ['refactor/README.md', 'clients/desktop/packages/desktop-rpc/src/frames.test.ts'],
    projects,
  )
  expect(changes.matrix.map((row) => row.target)).toEqual(['linux-x64'])
  expect(changes.matrix[0]!.tasks).toEqual(projects.libraries.map((name) => name + '#verify'))
})

test('a desktop dependency, shared input or removed project selects the complete desktop matrix', () => {
  for (const file of [
    'clients/desktop/packages/desktop-appearance/src/styles.css',
    'clients/desktop/app/release-notes/next/en.md',
    'pnpm-lock.yaml',
    'clients/desktop/packages/removed/package.json',
  ]) {
    const { matrix } = planChecks(
      [file, 'clients/desktop/packages/desktop-rpc/package.json'],
      projects,
    )
    expect(matrix).toHaveLength(6)
    expect(
      matrix.every((row) => row.tasks.includes('@kisaki3/desktop#verify') && row.packaging),
    ).toBe(true)
    expect(
      matrix.filter((row) => row.checks.includes('libraries')).map((row) => row.target),
    ).toEqual(['linux-x64'])
  }
})

test('a missing baseline verifies every host; manual performance runs can target one or all', () => {
  expect(planChecks(undefined, projects).matrix).toHaveLength(6)

  const single = planChecks(undefined, projects, 'macos-x64', 'performance')
  expect(single.matrix.map(({ target, tasks }) => [target, tasks])).toEqual([
    ['macos-x64', ['@kisaki3/desktop#test:performance']],
  ])
  const all = planChecks(undefined, projects, 'all', 'performance')
  expect(all.matrix).toHaveLength(6)
  expect(
    all.matrix.every((row) => row.tasks.length === 1 && row.checks.includes('performance')),
  ).toBe(true)
})
