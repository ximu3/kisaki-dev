import { cp, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { searchForWorkspaceRoot } from 'vite-plus'
import type { test as viteTest } from 'vite-plus/test'
import { stringify } from 'yaml'
import { run, runPnpm } from '../process/index.ts'

/**
 * Resolves the archives for the package under test and its workspace runtime dependencies.
 * pnpm's installed workspace links identify the owning projects.
 */
async function consumerArchives(project: string): Promise<Record<string, string>> {
  const archives: Record<string, string> = {}

  async function visit(directory: string): Promise<void> {
    const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')) as {
      name: string
      dependencies?: Record<string, string>
    }
    if (Object.hasOwn(archives, manifest.name)) {
      return
    }
    archives[manifest.name] = join(directory, 'out/package/package.tgz')
    for (const [name, version] of Object.entries(manifest.dependencies ?? {})) {
      if (version.startsWith('workspace:')) {
        await visit(await realpath(join(directory, 'node_modules', name)))
      }
    }
  }

  await visit(project)
  return archives
}

/** Creates a real external installation, registering cleanup before copying any fixture files. */
export async function installConsumer(
  fixture: string,
  project: string,
  cleanup: (dispose: () => Promise<void>) => void,
  signal?: AbortSignal,
): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'kisaki-package-consumer-'))
  cleanup(() => rm(directory, { recursive: true, force: true }))
  await cp(fixture, directory, { recursive: true })

  const file = join(directory, 'package.json')
  const manifest = JSON.parse(await readFile(file, 'utf8')) as {
    dependencies: Record<string, string>
  }
  const archives = await consumerArchives(project)
  const overrides: Record<string, string> = {}
  for (const [name, archive] of Object.entries(archives)) {
    const source = `file:${archive.replaceAll('\\', '/')}`
    overrides[name] = source
    if (Object.hasOwn(manifest.dependencies, name)) {
      manifest.dependencies[name] = source
    }
  }
  await writeFile(file, JSON.stringify(manifest))
  // Keep writable installations inside this fixture even when pnpm uses a global virtual store.
  await writeFile(
    join(directory, 'pnpm-workspace.yaml'),
    stringify({ autoInstallPeers: false, virtualStoreDir: 'node_modules/.pnpm', overrides }),
  )
  await runPnpm(['install', '--no-frozen-lockfile', '--ignore-scripts'], { cwd: directory, signal })
  return directory
}

export function createConsumerTest(
  test: typeof viteTest,
  project: string,
  host: 'node' | 'browser',
  prepare?: (directory: string) => Promise<void>,
) {
  const fixture = join(project, 'tests/consumers/fixtures', host)
  return test.extend('consumerDirectory', { scope: 'file' }, async ({}, { onCleanup }) => {
    const directory = await installConsumer(fixture, project, onCleanup)
    await prepare?.(directory)
    return directory
  })
}

/** Applies the workspace's lint rules to consumer sources using their installed declarations and type projects. */
export async function lintConsumer(directory: string, signal?: AbortSignal): Promise<void> {
  const bin = fileURLToPath(import.meta.resolve('vite-plus/bin'))
  const workspace = searchForWorkspaceRoot(import.meta.dirname)
  await run(
    process.execPath,
    [
      bin,
      'lint',
      '--config',
      join(workspace, 'vite.config.ts'),
      '--ignore-path',
      join(workspace, '.gitignore'),
      '.',
    ],
    { cwd: directory, signal },
  )
}
