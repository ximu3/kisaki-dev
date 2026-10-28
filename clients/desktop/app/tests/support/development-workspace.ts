/**
 * @fileoverview Prepares an isolated workspace with installed dependencies for tests that
 * edit and rebuild development inputs.
 */

import { createRequire } from 'node:module'
import { cp, copyFile, mkdtemp, realpath, rm } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { tmpdir } from 'node:os'
import { appRoot, repositoryRoot } from '../../tools/lib/paths'
import { hostTarget } from '../../tools/lib/targets'
import { electronExecutable } from '../../tools/dev/electron-executable'
import { readPnpm, run } from '@kisaki3/tooling/process'

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
      'tsconfig.json',
      '.npmrc',
      '.node-version',
      '.prettierrc.json',
      '.gitignore',
      '.gitattributes',
      'eslint.config.ts',
    ]) {
      await copyFile(join(repositoryRoot, file), join(root, file))
    }

    await cp(join(repositoryRoot, 'config', 'typescript'), join(root, 'config', 'typescript'), {
      recursive: true,
    })

    const ignored = new Set([
      'node_modules',
      'out',
      'dist',
      '.cache',
      '.local',
      'target',
      '.vitest',
      '.turbo',
      'test-results',
      'playwright-report',
    ])
    for (const directory of ['clients', 'packages']) {
      await cp(join(repositoryRoot, directory), join(root, directory), {
        recursive: true,
        filter(path) {
          return !relative(join(repositoryRoot, directory), path)
            .split(/[\\/]/)
            .some((part) => ignored.has(part))
        },
      })
    }

    // Turbo needs a valid HEAD to keep generated outputs out of its default input set.
    await run('git', ['init', '--quiet'], { cwd: root })
    await run(
      'git',
      [
        '-c',
        'core.hooksPath=',
        '-c',
        'commit.gpgSign=false',
        '-c',
        'user.name=Fixture',
        '-c',
        'user.email=fixture@example.invalid',
        'commit',
        '--allow-empty',
        '--quiet',
        '-m',
        'Initialize development fixture',
      ],
      { cwd: root },
    )

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

    // Electron installs its binary on first import; prepare it before copying the distribution.
    electronExecutable()

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
