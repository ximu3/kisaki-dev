import { afterEach, beforeEach, expect, test } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sourceIdentity } from '../../../tools/build/identity'

let root: string
let packageRoot: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'kisaki-build-inputs-'))
  const application = join(root, 'clients', 'desktop', 'app')
  packageRoot = join(root, 'clients', 'desktop', 'packages', 'fixture')

  for (const directory of ['src', 'native', 'tools', 'assets', 'config']) {
    await mkdir(join(application, directory), { recursive: true })
  }
  for (const directory of ['src', 'tools', 'config/typescript']) {
    await mkdir(join(packageRoot, directory), { recursive: true })
  }
  await mkdir(join(root, 'packages', 'typescript-config'), { recursive: true })
  await mkdir(join(root, 'packages', 'tooling', 'src'), { recursive: true })
  for (const file of ['pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json']) {
    await writeFile(join(root, file), '{}\n')
  }
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

test('a valid nested public-package compiler option changes the desktop build identity', async () => {
  const configuration = join(packageRoot, 'config', 'typescript', 'tsconfig.lib.json')
  await writeFile(configuration, JSON.stringify({ compilerOptions: { target: 'ES2023' } }))
  const previous = await sourceIdentity(root)

  await writeFile(configuration, JSON.stringify({ compilerOptions: { target: 'ES2022' } }))

  expect(await sourceIdentity(root)).not.toBe(previous)
})

test('public-package outputs and local state do not change the desktop build identity', async () => {
  const previous = await sourceIdentity(root)

  for (const directory of ['dist', 'out', '.cache', '.local']) {
    await mkdir(join(packageRoot, directory))
    await writeFile(join(packageRoot, directory, 'generated.json'), '{}\n')
  }

  expect(await sourceIdentity(root)).toBe(previous)
})

test('the root tooling resolution configuration changes the desktop build identity', async () => {
  const previous = await sourceIdentity(root)

  await writeFile(
    join(root, 'tsconfig.json'),
    JSON.stringify({ extends: '@kisaki3/typescript-config/base.json' }),
  )

  expect(await sourceIdentity(root)).not.toBe(previous)
})

test.each(['typescript-config/base.json', 'tooling/src/process.ts'])(
  'private engineering input %s changes the desktop build identity',
  async (file) => {
    const previous = await sourceIdentity(root)

    await writeFile(join(root, 'packages', file), 'changed input\n')

    expect(await sourceIdentity(root)).not.toBe(previous)
  },
)

test('private engineering outputs and test fixtures do not change the desktop build identity', async () => {
  const previous = await sourceIdentity(root)

  for (const directory of ['dist', 'out', '.cache', '.turbo', 'tests', 'test-results']) {
    await mkdir(join(root, 'packages', 'tooling', directory))
    await writeFile(join(root, 'packages', 'tooling', directory, 'generated.json'), '{}\n')
  }

  expect(await sourceIdentity(root)).toBe(previous)
})
