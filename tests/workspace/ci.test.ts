/** @fileoverview Verifies representative PR changes select the hosts that can observe their failures. */

import { expect, test } from 'vite-plus/test'
import { planChecks } from '../../tools/ci/plan'

test('documentation needs no host and mixed changes retain each required scenario', () => {
  const docs = planChecks(['refactor/README.md'])
  expect(docs.code).toBe(false)
  expect(docs.matrix).toEqual([])

  const changes = planChecks([
    'clients/desktop/packages/desktop-appearance/src/styles.css',
    'packages/tooling/src/process/windows.ts',
  ])
  const linux = changes.matrix.find((row) => row.target === 'linux-x64')!
  expect(linux.suites).toEqual(['consumers', 'browser'])
  expect(linux.packages).toContain('@kisaki3/desktop-ui')
  expect(
    changes.matrix.filter((row) => row.suites.includes('process')).map((row) => row.target),
  ).toEqual(['windows-x64', 'windows-arm64'])
})

test('shared native ABI changes cover every target and a manual reproduction stays on its host', () => {
  const native = planChecks(['clients/desktop/app/native/src/lib.rs'])
  expect(native.matrix.filter((row) => row.suites.includes('native'))).toHaveLength(6)
  expect(
    planChecks([], true, 'macos-x64', 'dev').matrix.map(({ target, suites }) => ({
      target,
      suites,
    })),
  ).toEqual([{ target: 'macos-x64', suites: ['dev'] }])
})
