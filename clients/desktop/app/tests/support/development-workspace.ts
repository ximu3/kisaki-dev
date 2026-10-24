import { createRequire } from 'node:module'
import { cp, copyFile, mkdtemp, realpath, rm } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { tmpdir } from 'node:os'
import { appRoot, repositoryRoot } from '../../tools/lib/paths'
import { hostTarget } from '../../tools/lib/targets'
import { readPnpm } from '../../tools/lib/process'

/** Copy the workspace for source-editing tests; close() removes the copy after its session stops. */
export async function prepareDevelopmentWorkspace(): Promise<{
  root: string
  app: string
  close(): Promise<void>
}> {
  const temporary = await mkdtemp(join(tmpdir(), 'kisaki-dev-workspace-'))
  try {
    // Resolve short paths before pnpm records dependency links and Vite resolves module locations.
    const root = await realpath(temporary)
    const app = join(root, 'clients', 'desktop', 'app')

    for (const file of [
      'package.json',
      'pnpm-workspace.yaml',
      'pnpm-lock.yaml',
      'turbo.json',
      'tsconfig.base.json',
      '.npmrc',
      '.prettierrc.json',
      '.gitignore',
      'eslint.config.ts',
    ]) {
      await copyFile(join(repositoryRoot, file), join(root, file))
    }

    const ignored = new Set([
      'node_modules',
      'out',
      'dist',
      '.cache',
      '.local',
      'target',
      '.vitest',
      'test-results',
      'playwright-report',
    ])
    await cp(join(repositoryRoot, 'clients'), join(root, 'clients'), {
      recursive: true,
      filter(path) {
        return !relative(join(repositoryRoot, 'clients'), path)
          .split(/[\\/]/)
          .some((part) => ignored.has(part))
      },
    })

    const store = await readPnpm(['store', 'path'], repositoryRoot)
    try {
      await readPnpm(
        [
          'install',
          '--store-dir',
          dirname(store.trim()),
          '--offline',
          '--ignore-scripts',
          '--frozen-lockfile',
        ],
        root,
      )
    } catch (cause) {
      const failure = cause as { stdout?: string; stderr?: string }
      throw new Error(
        `Fixture installation failed:\n${`${failure.stdout ?? ''}\n${failure.stderr ?? ''}`.slice(-8_192)}`,
        { cause },
      )
    }

    const originalRequire = createRequire(join(appRoot, 'package.json'))
    const fixtureRequire = createRequire(join(app, 'package.json'))
    const originalElectron = dirname(originalRequire.resolve('electron/package.json'))
    const fixtureElectron = dirname(fixtureRequire.resolve('electron/package.json'))
    if ((await realpath(originalElectron)) !== (await realpath(fixtureElectron))) {
      // macOS framework links must keep their relative targets inside the copied application bundle.
      await cp(join(originalElectron, 'dist'), join(fixtureElectron, 'dist'), {
        recursive: true,
        verbatimSymlinks: true,
      })
      await copyFile(join(originalElectron, 'path.txt'), join(fixtureElectron, 'path.txt'))
    }

    const target = hostTarget()
    // Cargo dependencies may be reused, but the copied crate and its target output remain isolated.
    await cp(join(appRoot, '.cache', 'native', target), join(app, '.cache', 'native', target), {
      recursive: true,
    })

    return {
      root,
      app,
      close: () => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }),
    }
  } catch (cause) {
    await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    throw cause
  }
}
