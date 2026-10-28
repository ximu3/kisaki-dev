import { afterAll, beforeAll, expect, test, vi } from 'vitest'
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startRenderer } from '../../tools/dev/renderer'
import { startInputWatcher } from '../../tools/dev/inputs'

const paths = vi.hoisted(() => ({ appRoot: '', repositoryRoot: '' }))
// Only relocate owned files; use the actual Vite server and Chokidar input watcher.
vi.mock('../../tools/lib/paths', () => paths)

let renderer: Awaited<ReturnType<typeof startRenderer>> | undefined
let inputs: Awaited<ReturnType<typeof startInputWatcher>> | undefined
const changes: string[] = []
const errors: unknown[] = []

beforeAll(async () => {
  const originalApp = fileURLToPath(new URL('../..', import.meta.url))
  await mkdir(join(originalApp, '.local'), { recursive: true })
  paths.repositoryRoot = await mkdtemp(join(originalApp, '.local', 'inputs-test-'))
  paths.appRoot = join(paths.repositoryRoot, 'clients/desktop/app')
  for (const directory of [
    'config/vite',
    'src/main',
    'src/preload',
    'src/extension-host',
    'src/shared',
    'native',
    'assets',
  ]) {
    await mkdir(join(paths.appRoot, directory), { recursive: true })
  }
  await copyFile(
    join(originalApp, 'config/vite/vite.config.renderer.ts'),
    join(paths.appRoot, 'config/vite/vite.config.renderer.ts'),
  )
  for (const name of ['main', 'reader', 'player', 'game-panel']) {
    const directory = join(paths.appRoot, 'src/renderer/windows', name)
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, 'index.html'), '<!doctype html><main>Watcher fixture</main>')
  }
  await writeFile(join(paths.appRoot, 'package.json'), '{"type":"module"}')
  await writeFile(join(paths.appRoot, 'config/vite/vite.config.main.ts'), 'export default {}\n')
  await writeFile(join(paths.repositoryRoot, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n')
  const member = join(paths.repositoryRoot, 'package')
  await mkdir(join(member, 'config/typescript'), { recursive: true })
  await writeFile(join(member, 'package.json'), '{"name":"@kisaki3/watch-fixture"}')
  await writeFile(join(member, 'config/typescript/tsconfig.lib.json'), '{}\n')
  const members = [{ name: '@kisaki3/watch-fixture', path: member }]
  renderer = await startRenderer(members, join(paths.repositoryRoot, 'snapshots'))
  inputs = await startInputWatcher(members, {
    onChange: (change) => changes.push(change),
    onError: (cause) => errors.push(cause),
  })
  // Initial adoption restarts Vite. Watch subscriptions must survive that real restart.
  await renderer.adopt({ id: 'empty-fixture', sizeBytes: 0, packages: new Map() })
})

afterAll(async () => {
  await inputs?.close()
  await renderer?.close()
  if (paths.repositoryRoot) {
    // Vite may still finish a cache write as its server closes; retry transient directory removal.
    await rm(paths.repositoryRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
})

test('runtime configuration and nested public-package inputs remain watched after Vite restarts', async () => {
  const previous = changes.length
  await writeFile(
    join(paths.repositoryRoot, 'package/config/typescript/tsconfig.tests.json'),
    '{"compilerOptions":{"strict":true}}',
  )
  // Allow real filesystem events to settle before a positive change proves the watcher is live.
  await new Promise((resolve) => setTimeout(resolve, 200))
  expect(changes).toHaveLength(previous)

  for (const [path, content, kind] of [
    [
      join(paths.appRoot, 'config/vite/vite.config.main.ts'),
      'export default { mode: "development" }\n',
      'runtime',
    ],
    [
      join(paths.appRoot, 'package.json'),
      '{"type":"module","imports":{"#fixture":"./src/main/entry.ts"}}',
      'runtime',
    ],
    [
      join(paths.repositoryRoot, 'package/config/typescript/tsconfig.lib.json'),
      '{"compilerOptions":{"strict":true}}',
      'public-package',
    ],
    [join(paths.appRoot, 'src/main/added.ts'), 'export const value = 1\n', 'runtime'],
    [join(paths.repositoryRoot, 'package/config/typescript/added.json'), '{}\n', 'public-package'],
  ] as const) {
    const before = changes.filter((change) => change === kind).length
    await writeFile(path, content)
    await expect
      .poll(() => changes.filter((change) => change === kind).length, {
        message: `Expected ${kind} notification for ${relative(paths.repositoryRoot, path)}`,
      })
      .toBeGreaterThan(before)
  }
  expect(errors).toEqual([])
})
