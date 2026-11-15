/** @fileoverview Verifies representative PR changes select the hosts that can observe their failures. */

import { expect, test } from 'vite-plus/test'
import { planChecks } from '../../tools/ci/plan'

test('documentation needs no host and mixed changes retain each required scenario', () => {
  const docs = planChecks(['refactor/README.md'])
  expect(docs.code).toBe(false)
  expect(docs.matrix).toEqual([])

  const checker = planChecks(['tools/check-doc-links.ts'])
  expect(checker.code).toBe(true)
  expect(checker.matrix).toEqual([])

  const changes = planChecks([
    'clients/desktop/packages/desktop-appearance/src/styles.css',
    'packages/tooling/src/process/windows.ts',
  ])
  const linux = changes.matrix.find((row) => row.target === 'linux-x64')!
  expect(linux.suites).toEqual(['consumers', 'browser'])
  expect(linux.tasks).toContain('@kisaki3/desktop-ui#test:consumers')
  expect(
    changes.matrix.filter((row) => row.suites.includes('tooling')).map((row) => row.target),
  ).toEqual(['windows-x64', 'windows-arm64'])
})

test('shared native ABI changes cover every target and a manual reproduction stays on its host', () => {
  const native = planChecks(['clients/desktop/app/native/src/lib.rs'])
  expect(native.matrix.filter((row) => row.suites.includes('native'))).toHaveLength(6)
  expect(
    planChecks([], true, 'macos-x64', 'dev-session').matrix.map(({ target, suites }) => ({
      target,
      suites,
    })),
  ).toEqual([{ target: 'macos-x64', suites: ['dev-session'] }])
})

test('a public preference parser change reaches its desktop database consumer', () => {
  const plan = planChecks(['clients/desktop/packages/desktop-contracts/src/preferences/api.ts'])
  const linux = plan.matrix.find((row) => row.target === 'linux-x64')!
  expect(linux.tasks).toContain('@kisaki3/desktop#test:native')
})

test('the measurement host checks changes to storage ordering and its performance task', () => {
  const collation = planChecks(['clients/desktop/app/native/src/collation.rs'])
  expect(collation.matrix.filter((row) => row.suites.includes('native'))).toHaveLength(6)
  expect(
    collation.matrix.filter((row) => row.suites.includes('performance')).map((row) => row.target),
  ).toEqual(['linux-x64'])

  const tasks = planChecks(['clients/desktop/app/vite.config.ts'])
  expect(tasks.matrix.find((row) => row.target === 'linux-x64')!.tasks).toContain(
    '@kisaki3/desktop#test:performance',
  )

  const files = planChecks(['clients/desktop/app/native/src/files.rs'])
  expect(files.matrix.some((row) => row.suites.includes('performance'))).toBe(false)
})
