/** @fileoverview Verifies package selection, native host coverage and manual task ownership. */

import { expect, test } from 'vite-plus/test'
import { verificationPackages } from '../../tools/ci/packages'
import type { VerificationPackage } from '../../tools/ci/packages'
import { planChecks } from '../../tools/ci/plan'
import type { CheckRequest } from '../../tools/ci/plan'
import { selectPackages } from '../../tools/ci/selection'
import { listProjects } from '../../tools/workspace'

/** The candidate's actual workspace manifests. */
const workspace = listProjects()

/** Target checks registered for this checkout. */
const packages = verificationPackages(workspace)

/** Plans a candidate diff or a manual request against the actual pnpm graph. */
function plan(paths?: readonly string[], request?: CheckRequest) {
  return planChecks(selectPackages(paths, workspace), packages, request)
}

test('repository docs skip targets and a package-owned change runs its entire check', () => {
  const docs = plan(['refactor/README.md', 'AGENTS.md'])
  expect(docs.code).toBe(false)
  expect(docs.matrix).toEqual([])

  const rpc = plan([
    'refactor/README.md',
    'clients/desktop/packages/desktop-rpc/src/frames.test.ts',
  ])
  expect(rpc.code).toBe(true)
  expect(rpc.matrix).toMatchObject([
    { label: '@kisaki3/desktop-rpc, linux-x64', task: '@kisaki3/desktop-rpc#verify', x11: true },
  ])
  expect(rpc.matrix[0]!.chromium).toBeFalsy()

  const releaseNotes = plan(['clients/desktop/app/release-notes/next/en.md'])
  expect(releaseNotes.matrix).toHaveLength(6)
  expect(releaseNotes.matrix.every((row) => row.task === '@kisaki3/desktop#verify')).toBe(true)
})

test('mixed package changes include their direct and transitive dependents', () => {
  const { matrix } = plan([
    'clients/desktop/packages/desktop-appearance/src/styles.css',
    'clients/desktop/packages/desktop-rpc/package.json',
  ])
  expect(new Set(matrix.map((row) => row.package))).toEqual(
    new Set([
      '@kisaki3/desktop-appearance',
      '@kisaki3/desktop-contracts',
      '@kisaki3/desktop-localization',
      '@kisaki3/desktop-rpc',
      '@kisaki3/desktop-ui',
      '@kisaki3/desktop',
    ]),
  )
  expect(matrix.filter((row) => row.package === '@kisaki3/desktop')).toHaveLength(6)
})

test('shared or unowned inputs use the full native plan, including the tooling hosts', () => {
  const full = plan()
  for (const path of ['pnpm-lock.yaml', 'clients/desktop/packages/removed/package.json']) {
    expect(plan([path]).matrix).toEqual(full.matrix)
  }
  const tooling = full.matrix.filter((row) => row.package === '@kisaki3/tooling')
  expect(tooling.map((row) => row.target).sort()).toEqual([
    'linux-arm64',
    'macos-arm64',
    'macos-x64',
    'windows-arm64',
    'windows-x64',
  ])
  expect(tooling.every((row) => row.task === '@kisaki3/tooling#test')).toBe(true)
  const changed = plan(['packages/tooling/src/process/index.ts'])
  expect(changed.scope).toBe('affected')
  expect(changed.matrix.filter((row) => row.package === '@kisaki3/tooling')).toEqual(tooling)
})

test('manual checks resolve the task within its package and run on the requested hosts', () => {
  const request = { package: '@kisaki3/desktop', task: 'test:performance' }
  expect(plan(undefined, request).matrix).toHaveLength(6)
  expect(plan(undefined, { ...request, target: 'macos-x64' }).matrix).toMatchObject([
    {
      label: '@kisaki3/desktop, test:performance, macos-x64',
      task: '@kisaki3/desktop#test:performance',
      performanceReport: 'clients/desktop/app/test-results/performance/results.json',
    },
  ])
  const rpc = { package: '@kisaki3/desktop-rpc', target: 'windows-arm64' }
  expect(plan(undefined, rpc).matrix).toMatchObject([{ task: rpc.package + '#verify', x11: false }])
  expect(() => plan(undefined, { ...rpc, task: 'test:browser' })).toThrow(rpc.package)
  expect(() => plan(undefined, { task: request.task })).toThrow('Select a workspace package')
})

test('another product registers its own tasks and host coverage', () => {
  const service: VerificationPackage = {
    name: '@fixture/service',
    directory: 'services/sample',
    defaultTask: 'verify',
    targets: ['linux-x64'],
    tasks: { verify: {}, 'test:performance': {} },
  }
  expect(() => verificationPackages([...workspace, service])).toThrow(service.name)

  const selected = { scope: 'affected', projects: [service] } as const
  const registered = [...packages, service]
  expect(planChecks(selected, registered).matrix).toMatchObject([
    { task: service.name + '#verify' },
  ])
  const request = { package: service.name, task: 'test:performance' }
  expect(planChecks(selected, registered, request).matrix).toMatchObject([
    { task: service.name + '#test:performance', target: 'linux-x64' },
  ])
  expect(() => planChecks(selected, registered, { ...request, target: 'macos-x64' })).toThrow(
    'macos-x64',
  )
})
