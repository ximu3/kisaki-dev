/**
 * @fileoverview Prepares an isolated workspace with installed dependencies for tests that
 * edit and rebuild development inputs.
 */

import { createRequire } from 'node:module'
import { cp, copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { tmpdir } from 'node:os'
import { appRoot, repositoryRoot } from '../../../tools/lib/paths'
import { hostTarget } from '../../../tools/lib/targets'
import { electronExecutable } from '../../../tools/dev/electron-executable'
import { readPnpm, run } from '@kisaki3/tooling/process'
import { rethrowAfterCleanup } from '@kisaki3/tooling/errors'

/**
 * Prepares an isolated source-editing workspace with installed dependencies.
 *
 * Uses the existing Electron installation and host native cache as inputs. Preparation failure
 * removes the copy; after success the caller closes it after all development sessions stop.
 */
export async function prepareDevelopmentWorkspace(): Promise<{
  root: string
  app: string

  /** Removes the copied workspace after the caller stops its development sessions. */
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
        /**
         * Copies maintained inputs while excluding dependency, cache and generated-output
         * directories.
         */
        filter(path) {
          return !relative(join(repositoryRoot, directory), path)
            .split(/[\\/]/)
            .some((part) => ignored.has(part))
        },
      })
    }

    // A synthetic dependency exercises package rebuilds without retaining a product stub.
    const fixture = join(root, 'packages/development-fixture')
    await mkdir(join(fixture, 'src'), { recursive: true })
    await writeFile(
      join(fixture, 'package.json'),
      JSON.stringify({
        name: '@kisaki3/development-fixture',
        version: '1.0.0',
        type: 'module',
        exports: { '.': './dist/index.js' },
        scripts: { build: 'node build.mjs' },
      }),
    )
    await writeFile(join(fixture, 'src/value.json'), JSON.stringify({ label: 'initial' }))
    await writeFile(
      join(fixture, 'build.mjs'),
      `
/** @fileoverview Builds the synthetic dependency used by development-session tests. */

import { mkdir, readFile, writeFile } from 'node:fs/promises'

/** The source value emitted by this synthetic package's build. */
const value = JSON.parse(await readFile(new URL('./src/value.json', import.meta.url), 'utf8'))

await mkdir(new URL('./dist/', import.meta.url), { recursive: true })
await writeFile(new URL('./dist/index.js', import.meta.url), 'export const label = ' + JSON.stringify(value.label))
`,
    )

    const appManifestPath = join(app, 'package.json')
    const appManifest = JSON.parse(await readFile(appManifestPath, 'utf8')) as {
      dependencies: Record<string, string>
    }
    appManifest.dependencies['@kisaki3/development-fixture'] = 'workspace:*'
    await writeFile(appManifestPath, JSON.stringify(appManifest))

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

    // Reuse archives; resolving the synthetic workspace can require registry metadata.
    const store = await readPnpm(['store', 'path'], repositoryRoot)
    try {
      await readPnpm(
        [
          'install',
          '--store-dir',
          dirname(store.trim()),
          '--prefer-offline',
          '--ignore-scripts',
          '--no-frozen-lockfile',
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

    /** Resolves the already installed Electron input from the original desktop package. */
    const originalRequire = createRequire(join(appRoot, 'package.json'))
    /** Resolves dependencies from the isolated copied desktop package. */
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
      /**
       * Removes the owned workspace tree with retries for transient filesystem cleanup failures.
       */
      close: () => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }),
    }
  } catch (cause) {
    return rethrowAfterCleanup(
      cause,
      () => rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }),
      'Development workspace preparation and cleanup failed',
    )
  }
}
