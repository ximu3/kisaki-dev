/**
 * @fileoverview Verifies dependency boundaries with synthetic allowed and forbidden
 * imports across project scopes.
 */

import { afterAll, beforeAll, expect, test } from 'vite-plus/test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

/** Installed dependency-cruiser entry used to inspect the synthetic import graph. */
const executable = resolve('node_modules/dependency-cruiser/bin/dependency-cruiser.mjs')

/** Synthetic imports exercising project, runtime and public-package dependency boundaries. */
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
    from: 'clients/desktop/packages/extension-distribution/src/registry.ts',
    to: 'clients/desktop/packages/extension-distribution/src/node/signing.ts',
    source: "export type { Value } from './node/signing'\n",
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
    name: 'engineering-does-not-import-tests',
    from: 'clients/desktop/app/tools/runtime.ts',
    to: 'clients/desktop/app/tests/support/value.ts',
    source: "export type { Value } from '../tests/support/value'\n",
  },
  {
    name: 'no-undeclared-packages',
    from: 'clients/desktop/app/tools/undeclared.ts',
    source: "export { value } from 'undeclared-tool'\n",
  },
  {
    name: 'engineering tools use private package exports',
    allowed: true,
    from: 'clients/desktop/app/tools/process.ts',
    to: 'packages/tooling/src/process/index.ts',
    source: "export type { Value } from '@kisaki3/tooling/process'\n",
  },
]

/** Isolated source root containing only the dependency-boundary test cases. */
let directory: string

/** Dependency-cruiser graph and rule violations collected for the current suite. */
let result: {
  modules: { source: string }[]
  summary: { violations: { from: string; rule: { name: string } }[] }
}

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'kisaki-boundaries-'))

  for (const file of [
    '.dependency-cruiser.json',
    'tsconfig.json',
    'packages/typescript-config/package.json',
    'packages/typescript-config/base.json',
    'clients/desktop/app/package.json',
  ]) {
    const target = join(directory, file)
    await mkdir(dirname(target), { recursive: true })
    await copyFile(resolve(file), target)
  }

  // Ancestor availability must not substitute for the importing project's declaration.
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({ private: true, devDependencies: { 'undeclared-tool': '1.0.0' } }),
  )

  const undeclared = join(directory, 'node_modules', 'undeclared-tool')
  await mkdir(undeclared, { recursive: true })
  await writeFile(
    join(undeclared, 'package.json'),
    JSON.stringify({ name: 'undeclared-tool', version: '1.0.0', main: './index.js' }),
  )
  await writeFile(join(undeclared, 'index.js'), 'exports.value = 1\n')

  const scope = join(directory, 'node_modules', '@kisaki3')
  await mkdir(scope, { recursive: true })
  await mkdir(join(directory, 'packages', 'tooling'), { recursive: true })
  await writeFile(
    join(directory, 'packages', 'tooling', 'package.json'),
    JSON.stringify({
      name: '@kisaki3/tooling',
      type: 'module',
      exports: { './process': './src/process/index.ts' },
    }),
  )

  for (const member of ['typescript-config', 'tooling']) {
    await symlink(join(directory, 'packages', member), join(scope, member), 'junction')
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

  let output: string
  try {
    output = (
      await promisify(execFile)(
        process.execPath,
        [executable, '--config', '.dependency-cruiser.json', '--output-type', 'json', '.'],
        { cwd: directory, windowsHide: true },
      )
    ).stdout
  } catch (cause) {
    if (!cause || typeof cause !== 'object' || !('stdout' in cause)) {
      throw cause
    }
    output = String(cause.stdout)
    if (!output.trim()) {
      throw cause
    }
  }

  result = JSON.parse(output) as typeof result
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
