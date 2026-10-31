/**
 * @fileoverview Verifies dependency boundaries with synthetic allowed and forbidden
 * imports across project scopes.
 */

import { afterAll, beforeAll, expect, test } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
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
    name: 'runtime-does-not-import-engineering',
    from: 'site/src/engineering.ts',
    source: "export type { Value } from '@kisaki3/tooling/process'\n",
  },
  {
    name: 'runtime may use a shared product library',
    allowed: true,
    from: 'site/src/library.ts',
    to: 'packages/shared/src/value.ts',
    source: "export type { Value } from '../../packages/shared/src/value'\n",
  },
  {
    name: 'runtime-does-not-import-engineering',
    from: 'clients/desktop/app/src/main/engineering.ts',
    to: 'packages/tooling/src/process.ts',
    source: "import type { Value } from '@kisaki3/tooling/process'\nexport type Alias = Value\n",
  },
  {
    name: 'main-and-extension-host-are-independent',
    from: 'clients/desktop/app/src/main/host.ts',
    to: 'clients/desktop/app/src/extension-host/entry.ts',
    source: "import type { Value } from '../extension-host/entry'\nexport type Alias = Value\n",
  },
  {
    name: 'renderer-has-no-node',
    from: 'clients/desktop/app/src/renderer/node.ts',
    source: "import { readFile } from 'node:fs/promises'\nexport { readFile }\n",
  },
  {
    name: 'renderer-has-no-node',
    from: 'clients/desktop/app/src/renderer/contest.ts',
    source: "export { readFile } from 'node:fs/promises'\n",
  },
  {
    name: 'renderer-cannot-load-electron-or-native',
    from: 'clients/desktop/app/src/renderer/electron.ts',
    source: "export { app } from 'electron'\n",
  },
  {
    name: 'runtime-does-not-import-engineering',
    from: 'clients/desktop/app/src/main/fixture.ts',
    to: 'clients/desktop/app/tests/fixture.test.ts',
    source: "export type { Value } from '../../tests/fixture.test'\n",
  },
  {
    name: 'appearance-dependency-direction',
    from: 'clients/desktop/packages/appearance/src/entry.ts',
    source: "export type { Value } from '@kisaki3/ui'\n",
  },
  {
    name: 'desktop-contracts may contain its own UI contracts',
    allowed: true,
    from: 'clients/desktop/packages/desktop-contracts/src/ui/contract.ts',
    to: 'clients/desktop/packages/desktop-contracts/src/ui/value.ts',
    source: "export type { Value } from './value'\n",
  },
  {
    name: 'desktop-contracts-dependency-direction',
    from: 'clients/desktop/packages/desktop-contracts/src/component.ts',
    source: "export type { Value } from '@kisaki3/ui'\n",
  },
  {
    name: 'no-undeclared-packages',
    from: 'clients/desktop/app/tools/undeclared.ts',
    source: "export { value } from 'undeclared-tool'\n",
  },
  {
    name: 'native-is-main-only',
    from: 'clients/desktop/app/src/preload/main.ts',
    to: 'clients/desktop/app/native/node/index.ts',
    source: "import type { Value } from '#native'\nexport type Alias = Value\n",
  },
  {
    name: 'package-private-source',
    from: 'clients/desktop/packages/rpc/src/index.ts',
    to: 'clients/desktop/packages/appearance/src/value.ts',
    source: "export type { Value } from '../../appearance/src/value'\n",
  },
  {
    name: 'engineering tools use private package exports',
    allowed: true,
    from: 'clients/desktop/app/tools/process.ts',
    to: 'packages/tooling/src/process.ts',
    source: "import type { Value } from '@kisaki3/tooling/process'\nexport type Alias = Value\n",
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

  const manifest = JSON.parse(
    await readFile(join(directory, 'clients/desktop/app/package.json'), 'utf8'),
  ) as { devDependencies: { electron: string } }
  const electronVersion = manifest.devDependencies.electron

  // Ancestor availability must not substitute for the importing project's declaration.
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({ private: true, devDependencies: { 'undeclared-tool': '1.0.0' } }),
  )

  const fixturePackages = [
    {
      path: 'clients/desktop/packages/desktop-contracts',
      manifest: {
        name: '@kisaki3/desktop-contracts',
        dependencies: { '@kisaki3/ui': '1.0.0' },
      },
      files: {},
    },
    {
      path: 'clients/desktop/packages/appearance',
      manifest: {
        name: '@kisaki3/appearance',
        dependencies: { '@kisaki3/ui': '1.0.0' },
      },
      files: {},
    },
    {
      path: 'clients/desktop/packages/ui',
      manifest: {
        name: '@kisaki3/ui',
        type: 'module',
        exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' } },
      },
      files: {
        'dist/index.d.ts': 'export interface Value { name: string }\n',
        'dist/index.js': 'export const value = 1\n',
      },
    },
    {
      path: `node_modules/.pnpm/electron@${electronVersion}/node_modules/electron`,
      manifest: { name: 'electron', version: electronVersion, main: './index.js' },
      files: { 'index.js': 'exports.app = {}\n' },
    },
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
  await symlink(join(directory, 'clients/desktop/packages/ui'), join(scope, 'ui'), 'junction')
  await symlink(
    join(directory, `node_modules/.pnpm/electron@${electronVersion}/node_modules/electron`),
    join(directory, 'node_modules/electron'),
    'junction',
  )

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
