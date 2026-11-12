/**
 * @fileoverview Installs and removes repository-owned Husky hooks across worktrees while
 * preserving unrelated hook configuration.
 */

import { spawnSync } from 'node:child_process'
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rethrowAfterCleanup } from '@kisaki3/tooling/errors'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

/** The outcome of installing or removing this repository's hooks. */
export interface HooksResult {
  status: 'installed' | 'uninstalled' | 'preserved' | 'skipped'
  message: string
}

/**
 * Runs Git in the selected repository, forwarding stderr and returning trimmed stdout and status.
 */
function git(directory: string, args: string[]): { status: number | null; output: string } {
  const result = spawnSync('git', args, {
    cwd: directory,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  if (result.error) {
    throw new Error('Could not run Git', { cause: result.error })
  }

  return { status: result.status, output: result.stdout.trim() }
}

/**
 * Installs or removes repository-owned hooks shared by every worktree.
 *
 * Skips disabled environments and source archives. Installation refuses foreign hook configuration;
 * removal preserves a user-replaced local path. If Husky setup fails on an initial install, rolls
 * back the local registration and owned hook files.
 */
export async function configureHooks(
  directory: string,
  operation: 'install' | 'uninstall',
): Promise<HooksResult> {
  if (process.env.CI || process.env.HUSKY === '0') {
    return { status: 'skipped', message: 'Hooks are disabled in this environment.' }
  }

  try {
    await access(join(directory, '.git'))
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
      return { status: 'skipped', message: 'Source archives do not install Git hooks.' }
    }
    throw cause
  }

  const worktree = git(directory, ['rev-parse', '--show-toplevel'])
  if (worktree.status !== 0) {
    throw new Error('Could not resolve the project Git root')
  }

  const root = worktree.output
  const commonDirectory = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir'])
  if (commonDirectory.status !== 0) {
    throw new Error('Could not resolve the shared Git directory')
  }

  const ownedDirectory = join(commonDirectory.output, 'kisaki-hooks')
  const ownedPath = join(ownedDirectory, '_').replaceAll('\\', '/')
  const localHookPath = git(root, ['config', '--local', '--get-all', 'core.hooksPath'])
  const effectiveHookPath = git(root, ['config', '--show-scope', '--get-all', 'core.hooksPath'])
  for (const result of [localHookPath, effectiveHookPath]) {
    if (result.status !== 0 && result.status !== 1) {
      throw new Error('Could not read the Git hook configuration')
    }
  }

  if (operation === 'uninstall') {
    if (localHookPath.status === 0 && localHookPath.output !== ownedPath) {
      return { status: 'preserved', message: 'The user changed core.hooksPath; it was preserved.' }
    }

    if (localHookPath.status === 0) {
      const removed = git(root, ['config', '--local', '--unset-all', 'core.hooksPath'])
      if (removed.status !== 0) {
        throw new Error('Could not remove the repository hook path')
      }
    }

    await rm(ownedDirectory, { recursive: true, force: true })

    return {
      status: 'uninstalled',
      message: 'Repository hooks were removed for all worktrees; recovery stashes were preserved.',
    }
  }

  if (effectiveHookPath.status === 0 && effectiveHookPath.output !== `local\t${ownedPath}`) {
    throw new Error('Explicit core.hooksPath conflicts with Kisaki hooks; no configuration changed')
  }

  const huskyBin = join(projectRoot, 'node_modules', 'husky', 'bin.js')
  try {
    await readFile(huskyBin)
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw cause
    }

    return {
      status: 'skipped',
      message: 'Install development dependencies before installing hooks.',
    }
  }

  await readFile(join(root, '.husky', 'pre-commit'))

  await mkdir(ownedDirectory, { recursive: true })
  await writeFile(
    join(ownedDirectory, 'pre-commit'),
    'sh "$(git rev-parse --show-toplevel)/.husky/pre-commit"\n',
  )

  const installed = spawnSync(process.execPath, [huskyBin, ownedDirectory.replaceAll('\\', '/')], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  })
  if (installed.error || installed.status !== 0 || installed.stdout.trim()) {
    const failure = new Error('Husky installation failed', {
      cause: installed.error ?? {
        status: installed.status,
        signal: installed.signal,
        stdout: installed.stdout,
        stderr: installed.stderr,
      },
    })
    if (localHookPath.status === 0) {
      // A failed reinstall must not remove the hook directory already configured by the user.
      throw failure
    }

    return rethrowAfterCleanup(
      failure,
      async () => {
        const removed = git(root, ['config', '--local', '--unset-all', 'core.hooksPath'])
        if (removed.status !== 0 && removed.status !== 5) {
          throw new Error('Could not roll back the repository hook path')
        }
        await rm(ownedDirectory, { recursive: true, force: true })
      },
      'Hook installation and rollback failed',
    )
  }

  return {
    status: 'installed',
    message: 'Repository pre-commit checks are installed for all worktrees.',
  }
}

if (import.meta.main) {
  const operation = process.argv[2]
  if (operation !== 'install' && operation !== 'uninstall') {
    console.error('Usage: hooks <install|uninstall>')
    process.exitCode = 1
  } else {
    try {
      const result = await configureHooks(projectRoot, operation)

      console.info(result.message)
    } catch (cause) {
      console.error(cause)
      process.exitCode = 1
    }
  }
}
