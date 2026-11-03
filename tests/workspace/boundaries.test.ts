/**
 * @fileoverview Verifies dependency boundaries with synthetic allowed and forbidden
 * imports across project scopes.
 */

import { afterAll, beforeAll, expect, test } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const executable = resolve('node_modules/dependency-cruiser/bin/dependency-cruiser.mjs')

const cases: {
  name: string
  from: string
  to?: string
  source: string
  allowed?: boolean
}[] = [
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
    to: 'packages/tooling/src/process.ts',
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
    to: 'packages/tooling/src/process.ts',
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

  const fixturePackages = [
    {
      path: 'node_modules/undeclared-tool',
      manifest: { name: 'undeclared-tool', version: '1.0.0', main: './index.js' },
      files: { 'index.js': 'exports.value = 1\n' },
    },
  ]

  for (const fixture of fixturePackages) {
    const root = join(directory, fixture.path)
    await mkdir(root, { recursive: true })
    await writeFile(join(root, 'package.json'), JSON.stringify(fixture.manifest))
    for (const [file, content] of Object.entries(fixture.files)) {
      await mkdir(dirname(join(root, file)), { recursive: true })
      await writeFile(join(root, file), content!)
    }
  }

  const scope = join(directory, 'node_modules', '@kisaki3')
  await mkdir(scope, { recursive: true })
  await mkdir(join(directory, 'packages', 'tooling'), { recursive: true })
  await writeFile(
    join(directory, 'packages', 'tooling', 'package.json'),
    JSON.stringify({
      name: '@kisaki3/tooling',
      type: 'module',
      exports: { './process': './src/process.ts' },
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
