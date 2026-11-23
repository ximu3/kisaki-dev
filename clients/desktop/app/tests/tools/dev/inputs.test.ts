import { afterAll, beforeAll, expect, test, vi } from 'vite-plus/test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { startInputWatcher } from '../../../tools/dev/inputs'

const paths = vi.hoisted(() => ({ appRoot: '', repositoryRoot: '' }))
vi.mock(import('../../../tools/lib/paths'), async (importOriginal) => ({
  ...(await importOriginal()),
  get appRoot() {
    return paths.appRoot
  },
  get repositoryRoot() {
    return paths.repositoryRoot
  },
}))

let inputs: Awaited<ReturnType<typeof startInputWatcher>> | undefined

const changes: string[] = []

const errors: unknown[] = []

beforeAll(async () => {
  paths.repositoryRoot = await mkdtemp(join(tmpdir(), 'kisaki-preparation-inputs-'))
  paths.appRoot = join(paths.repositoryRoot, 'app')
  for (const directory of [
    'app/config/vite',
    'app/config/typescript',
    'app/native',
    'app/assets',
    'app/drizzle',
    'app/src/main',
  ]) {
    await mkdir(join(paths.repositoryRoot, directory), { recursive: true })
  }
  await writeFile(join(paths.appRoot, 'package.json'), '{"type":"module"}')
  await writeFile(join(paths.appRoot, 'tsconfig.json'), '{}')
  await writeFile(join(paths.repositoryRoot, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n')
  inputs = await startInputWatcher(paths.appRoot, {
    watchAssets: true,
    onChange: (change) => changes.push(change),

    onError: (cause) => errors.push(cause),
  })
})

afterAll(async () => {
  await inputs?.close()
  if (paths.repositoryRoot) {
    await rm(paths.repositoryRoot, { recursive: true, force: true })
  }
})

test('resource and configuration changes select their actual preparation owner', async () => {
  for (const file of ['app/src/main/entry.ts', 'app/native/target/generated.json']) {
    const path = join(paths.repositoryRoot, file)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, 'excluded from preparation\n')
  }
  await new Promise((resolve) => setTimeout(resolve, 200))
  expect(changes).toEqual([])

  for (const [file, kind] of [
    ['app/config/vite/main.ts', 'configuration'],
    ['app/config/typescript/tsconfig.main.json', 'configuration'],
    ['app/native/src.rs', 'native'],
    ['app/assets/font.json', 'resources'],
    ['app/drizzle/migration.sql', 'resources'],
  ] as const) {
    const before = changes.filter((change) => change === kind).length
    await writeFile(join(paths.repositoryRoot, file), 'changed input\n')
    await expect
      .poll(() => changes.filter((change) => change === kind).length)
      .toBeGreaterThan(before)
  }
  expect(errors).toEqual([])
})
