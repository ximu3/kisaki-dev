import { afterAll, beforeAll, expect, test } from 'vite-plus/test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { listProjects } from '../../tools/workspace'

const executable = resolve('node_modules/dependency-cruiser/bin/dependency-cruiser.mjs')

const cases: {
  name: string
  from: string
  to?: string
  source: string
  allowed?: boolean
}[] = [
  {
    name: 'rpc-has-no-host-or-product-dependencies',
    from: 'clients/desktop/packages/desktop-rpc/src/frames.ts',
    to: 'clients/desktop/packages/desktop-contracts/src/json.ts',
    source: "export type { Value } from '../../desktop-contracts/src/json'\n",
  },
  {
    name: 'rpc-has-no-node-runtime',
    from: 'clients/desktop/packages/desktop-rpc/src/transport.ts',
    source: "export { MessageChannel } from 'node:worker_threads'\n",
  },
  {
    name: 'contracts-do-not-import-localization',
    from: 'clients/desktop/packages/desktop-contracts/src/i18n.ts',
    to: 'clients/desktop/packages/desktop-localization/src/index.ts',
    source: "export type { Value } from '../../desktop-localization/src/index'\n",
  },
  {
    name: 'localization-has-no-node-runtime',
    from: 'clients/desktop/packages/desktop-localization/src/translate.ts',
    source: "export { readFile } from 'node:fs/promises'\n",
  },
  {
    name: 'localization-has-no-application-or-ui-runtime',
    from: 'clients/desktop/packages/desktop-localization/src/context.ts',
    to: 'clients/desktop/app/src/main/i18n.ts',
    source: "export type { Value } from '../../../app/src/main/i18n'\n",
  },
  {
    name: 'contracts-have-no-node-runtime',
    from: 'clients/desktop/packages/desktop-contracts/src/resources.ts',
    source: "export { readFile } from 'node:fs/promises'\n",
  },
  {
    name: 'contracts-have-no-application-or-ui-runtime',
    from: 'clients/desktop/packages/desktop-contracts/src/sessions.ts',
    to: 'clients/desktop/app/src/main/sessions.ts',
    source: "export type { Value } from '../../../app/src/main/sessions'\n",
  },
  {
    name: 'distribution-pure-has-no-node-runtime',
    from: 'clients/desktop/packages/extension-distribution/src/manifest.ts',
    source: "export { readFile } from 'node:fs/promises'\n",
  },
  {
    name: 'distribution-pure-does-not-import-signing',
    from: 'clients/desktop/packages/extension-distribution/src/registry/index.ts',
    to: 'clients/desktop/packages/extension-distribution/src/node/signing.ts',
    source: "export type { Value } from '../node/signing'\n",
  },
  {
    name: 'distribution-has-no-application-runtime',
    from: 'clients/desktop/packages/extension-distribution/src/compatibility.ts',
    to: 'clients/desktop/app/src/main/extensions.ts',
    source: "export type { Value } from '../../../app/src/main/extensions'\n",
  },
  {
    name: 'appearance-has-no-node-runtime',
    from: 'clients/desktop/packages/desktop-appearance/src/node.ts',
    source: "export { readFile } from 'node:fs/promises'\n",
  },
  {
    name: 'appearance-has-no-application-runtime',
    from: 'clients/desktop/packages/desktop-appearance/src/application.ts',
    to: 'clients/desktop/app/src/main/appearance.ts',
    source: "export type { Value } from '../../../app/src/main/appearance'\n",
  },
  {
    name: 'runtime-does-not-import-engineering',
    from: 'clients/desktop/app/native/node/engineering.ts',
    to: 'packages/tooling/src/process/index.ts',
    source: "export type { Value } from '@kisaki3/tooling/process'\n",
  },
  {
    name: 'no-test-imports-outside-tests',
    from: 'clients/desktop/app/tools/runtime.ts',
    to: 'clients/desktop/app/tests/support/value.ts',
    source: "export type { Value } from '../tests/support/value'\n",
  },
  {
    name: 'no-test-imports-outside-tests',
    from: 'clients/desktop/app/src/main/preferences.ts',
    to: 'clients/desktop/app/src/main/defaults.test.ts',
    source: "export type { Value } from './defaults.test'\n",
  },
  {
    name: 'no-undeclared-packages',
    from: 'clients/desktop/app/tools/undeclared.ts',
    source: "export { value } from 'undeclared-tool'\n",
  },
  {
    name: 'desktop-native-is-main-only',
    from: 'clients/desktop/app/tests/fixtures/desktop-app/src/renderer/entry.ts',
    to: 'clients/desktop/app/native/node/index.ts',
    source: "export type { Value } from '#native'\n",
  },
  {
    name: 'use-desktop-native-import',
    from: 'clients/desktop/app/src/main/binding.ts',
    to: 'clients/desktop/app/native/node/files.ts',
    source: "import '../../native/node/files'\n",
  },
  {
    name: 'use-workspace-exports-from-@kisaki3/desktop-contracts',
    from: 'clients/desktop/packages/desktop-contracts/src/manifest.test.ts',
    to: 'clients/desktop/packages/extension-distribution/src/internal.ts',
    source: "export type { Value } from '../../extension-distribution/src/internal'\n",
  },
  {
    name: 'declare-workspace-dependencies-from-@kisaki3/desktop-rpc',
    from: 'clients/desktop/packages/desktop-rpc/tools/manifest.ts',
    to: 'clients/desktop/packages/extension-distribution/dist/manifest.d.ts',
    source: "export type { Value } from '@kisaki3/extension-distribution/manifest'\n",
  },
  {
    name: 'use-workspace-exports-from-@fixture/workspace',
    from: 'tools/output.ts',
    to: 'packages/tooling/src/process/index.ts',
    source: "export type { Value } from '../packages/tooling/src/process'\n",
  },
  {
    name: 'main consumes the native package import',
    allowed: true,
    from: 'clients/desktop/app/src/main/files.ts',
    to: 'clients/desktop/app/native/node/index.ts',
    source: "export type { Value } from '#native'\n",
  },
  {
    name: 'engineering tools use private package exports',
    allowed: true,
    from: 'clients/desktop/app/tools/process.ts',
    to: 'packages/tooling/src/process/index.ts',
    source: "export type { Value } from '@kisaki3/tooling/process'\n",
  },
]

let directory: string

let result: {
  modules: { source: string }[]
  summary: { violations: { from: string; rule: { name: string } }[] }
}

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'kisaki-boundaries-'))
  const members = listProjects().filter((project) => project.directory)

  for (const file of [
    '.dependency-cruiser.ts',
    'tools/workspace.ts',
    'pnpm-workspace.yaml',
    'tsconfig.json',
    'packages/config/typescript/base.json',
    ...members.map((project) => project.directory + '/package.json'),
  ]) {
    const target = join(directory, file)
    await mkdir(dirname(target), { recursive: true })
    await copyFile(resolve(file), target)
  }

  // Ancestor availability must not substitute for the importing project's declaration.
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({
      name: '@fixture/workspace',
      private: true,
      type: 'module',
      devDependencies: { '@kisaki3/tooling': 'workspace:*', 'undeclared-tool': '1.0.0' },
    }),
  )

  const undeclared = join(directory, 'node_modules', 'undeclared-tool')
  await mkdir(undeclared, { recursive: true })
  await writeFile(
    join(undeclared, 'package.json'),
    JSON.stringify({ name: 'undeclared-tool', version: '1.0.0', main: './index.js' }),
  )
  await writeFile(join(undeclared, 'index.js'), 'exports.value = 1\n')

  for (const member of members) {
    const link = join(directory, 'node_modules', member.name)
    await mkdir(dirname(link), { recursive: true })
    await symlink(join(directory, member.directory), link, 'junction')
  }

  const files: [string, string][] = cases.flatMap(({ from, to, source }) => {
    const inputs: [string, string][] = [[from, source]]
    if (to) {
      inputs.push([to, 'export interface Value { name: string }\n'])
    }
    return inputs
  })

  for (const [path, content] of files) {
    const file = join(directory, path)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, content)
  }

  const { stdout } = await promisify(execFile)(
    process.execPath,
    [executable, '--output-type', 'json', 'clients', 'packages', 'tools'],
    { cwd: directory, windowsHide: true },
  )
  result = JSON.parse(stdout) as typeof result
  expect(result.summary.violations.map((violation) => violation.rule.name)).not.toContain(
    'no-unresolved',
  )
})

afterAll(async () => {
  if (directory) {
    await rm(directory, { recursive: true, force: true })
  }
})

test.each(cases)('enforces module boundaries: $name from $from', ({ name, from, allowed }) => {
  const source = from
  expect(result.modules.some((module) => module.source === source)).toBe(true)

  const violations = result.summary.violations
    .filter((violation) => violation.from === source)
    .map((violation) => violation.rule.name)

  if (allowed) {
    expect(violations).toEqual([])
  } else {
    expect(violations).toContain(name)
  }
})
