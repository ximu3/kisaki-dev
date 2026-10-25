import { expect, test } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const executable = resolve('node_modules/dependency-cruiser/bin/dependency-cruiser.mjs')

test.each([
  {
    name: 'runtime-does-not-import-engineering',
    from: 'app/src/main/entry.ts',
    to: '../../tools/lib/process.ts',
    source: "import type { Value } from '@repo-tools/process'\nexport type Alias = Value\n",
  },
  {
    name: 'main-and-extension-host-are-independent',
    from: 'app/src/main/entry.ts',
    to: 'app/src/extension-host/entry.ts',
    source: "import type { Value } from '../extension-host/entry'\nexport type Alias = Value\n",
  },
  {
    name: 'renderer-has-no-node',
    from: 'app/src/renderer/entry.ts',
    to: 'app/src/shared/value.ts',
    source: "import { readFile } from 'node:fs/promises'\nexport { readFile }\n",
  },
  {
    name: 'native-is-main-only',
    from: 'app/src/preload/main.ts',
    to: 'app/native/node/index.ts',
    source: "import type { Value } from '#native'\nexport type Alias = Value\n",
  },
  {
    name: 'package-private-source',
    from: 'packages/rpc/src/index.ts',
    to: 'packages/appearance/src/value.ts',
    source: "export type { Value } from '../../appearance/src/value'\n",
  },
])(
  'rejects $name, including type imports and private package imports',
  async ({ name, from, to, source }) => {
    const directory = await mkdtemp(join(tmpdir(), 'kisaki-boundaries-'))
    try {
      for (const file of [
        '.dependency-cruiser.json',
        'tsconfig.base.json',
        'clients/desktop/app/package.json',
      ]) {
        const target = join(directory, file)
        await mkdir(dirname(target), { recursive: true })
        await copyFile(resolve(file), target)
      }
      for (const [path, content] of [
        [from, source],
        [to, 'export interface Value { name: string }\n'],
      ]) {
        const file = join(directory, 'clients/desktop', path!)
        await mkdir(dirname(file), { recursive: true })
        await writeFile(file, content!)
      }

      let output = ''
      try {
        output = (
          await promisify(execFile)(
            process.execPath,
            [
              executable,
              '--config',
              '.dependency-cruiser.json',
              '--output-type',
              'json',
              'clients',
            ],
            { cwd: directory, windowsHide: true },
          )
        ).stdout
      } catch (cause) {
        if (!cause || typeof cause !== 'object' || !('stdout' in cause)) throw cause
        output = String(cause.stdout)
        if (!output.trim()) throw cause
      }

      const result: { summary: { violations: { rule: { name: string } }[] } } = JSON.parse(output)
      expect(
        result.summary.violations.map((violation) => violation.rule.name),
        output.slice(0, 2_000),
      ).toContain(name)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  },
)
