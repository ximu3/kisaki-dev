import { expect, test } from 'vite-plus/test'
import { verificationPackages } from '../../tools/ci/packages'
import { planChecks, type CheckRequest } from '../../tools/ci/plan'
import { selectPackages } from '../../tools/ci/selection'
import { listProjects } from '../../tools/workspace'

const workspace = listProjects()

const packages = verificationPackages(workspace)

function plan(paths?: readonly string[], request?: CheckRequest) {
  return planChecks(selectPackages(paths, workspace), packages, request)
}

test('repository docs skip targets and package changes select installed consumption and dependent hosts', () => {
  const docs = plan(['refactor/README.md', 'AGENTS.md'])
  expect(docs.scope).toBe('docs')
  expect(docs.matrix).toEqual([])

  const rpc = plan([
    'refactor/README.md',
    'clients/desktop/packages/desktop-rpc/src/frames.test.ts',
  ])
  expect(rpc.scope).toBe('affected')
  expect(rpc.matrix.filter((row) => row.package === '@kisaki3/desktop-rpc')).toMatchObject([
    {
      label: '@kisaki3/desktop-rpc, linux-x64',
      task: '@kisaki3/desktop-rpc#test:consumers',
      consumerNode: '24.11.1',
      x11: true,
    },
  ])
  expect(rpc.matrix.find((row) => row.package === '@kisaki3/desktop-rpc')?.chromium).toBeFalsy()
  expect(rpc.matrix.filter((row) => row.package === '@kisaki3/desktop')).toHaveLength(6)

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
  expect(matrix.find((row) => row.package === '@kisaki3/desktop-ui')?.task).toBe(
    '@kisaki3/desktop-ui#test:hosts',
  )
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
  const requested = plan(undefined, rpc)
  expect(requested.scope).toBe('requested')
  expect(requested.matrix).toMatchObject([{ task: rpc.package + '#verify', x11: false }])
  expect(() => plan(undefined, { ...rpc, task: 'test:browser' })).toThrow(rpc.package)
  expect(() => plan(undefined, { ...rpc, target: 'unknown-target' })).toThrow('unknown-target')
  expect(() => plan(undefined, { task: request.task })).toThrow('Select a workspace package')
})

test('an unregistered workspace member cannot silently lose CI coverage', () => {
  const project = { name: '@fixture/unregistered', directory: 'clients/unregistered' }
  expect(() => verificationPackages([...workspace, project])).toThrow(project.name)
})
