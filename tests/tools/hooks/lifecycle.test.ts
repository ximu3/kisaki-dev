import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { spawnSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { configureHooks } from '../../../tools/hooks'

let directory: string
let repository: string
let globalConfig: string

/** Execute Git only in the synthetic repository, returning failures for explicit assertions. */
function git(args: string[], cwd = repository) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true })
  if (result.error) throw result.error
  return result
}

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'kisaki-hooks-'))
  repository = join(directory, 'repository')
  globalConfig = join(directory, 'global.gitconfig')
  await mkdir(repository)
  await writeFile(
    globalConfig,
    '[user]\n\tname = Hook Fixture\n\temail = fixture@example.invalid\n',
  )
  vi.stubEnv('GIT_CONFIG_GLOBAL', globalConfig)
  vi.stubEnv('GIT_CONFIG_NOSYSTEM', '1')
  vi.stubEnv('XDG_CONFIG_HOME', join(directory, 'config'))
  vi.stubEnv('CI', '')
  vi.stubEnv('HUSKY', '1')
  expect(git(['init', '-b', 'main']).status).toBe(0)
  await mkdir(join(repository, '.husky'))
  await copyFile(resolve('.husky/pre-commit'), join(repository, '.husky/pre-commit'))
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
})

test('installs idempotently, uninstalls cleanly, and never edits inherited configuration', async () => {
  const originalGlobal = await readFile(globalConfig, 'utf8')
  git(['config', '--local', 'fixture.keep', 'present'])

  expect((await configureHooks(repository, 'install')).status).toBe('installed')
  const firstPath = git(['config', '--local', '--get', 'core.hooksPath']).stdout
  expect((await configureHooks(repository, 'install')).status).toBe('installed')
  expect(git(['config', '--local', '--get', 'core.hooksPath']).stdout).toBe(firstPath)

  expect((await configureHooks(repository, 'uninstall')).status).toBe('uninstalled')
  expect(git(['config', '--local', '--get', 'core.hooksPath']).status).toBe(1)
  expect(git(['config', '--local', '--get', 'fixture.keep']).stdout.trim()).toBe('present')
  expect(await readFile(globalConfig, 'utf8')).toBe(originalGlobal)
})

test.each(['', '.other-hooks', '.lefthook'])(
  'preserves an explicit local hook path %j',
  async (path) => {
    git(['config', '--local', 'core.hooksPath', path])
    const original = await readFile(join(repository, '.git/config'), 'utf8')

    await expect(configureHooks(repository, 'install')).rejects.toThrow('conflicts')
    expect(await readFile(join(repository, '.git/config'), 'utf8')).toBe(original)
  },
)

test('rejects an inherited hook path, including an explicitly empty value', async () => {
  await writeFile(globalConfig, '[core]\n\thooksPath =\n')
  await expect(configureHooks(repository, 'install')).rejects.toThrow('conflicts')
  expect(git(['config', '--local', '--get', 'core.hooksPath']).status).toBe(1)
  expect(await readFile(globalConfig, 'utf8')).toBe('[core]\n\thooksPath =\n')
})

test('preserves a hook path changed by the user after installation', async () => {
  await configureHooks(repository, 'install')
  git(['config', '--local', 'core.hooksPath', '.user-hooks'])
  expect((await configureHooks(repository, 'uninstall')).status).toBe('preserved')
  expect(git(['config', '--local', '--get', 'core.hooksPath']).stdout.trim()).toBe('.user-hooks')
})

test('one repository-local installation and removal governs all worktrees', async () => {
  git(['add', '.husky/pre-commit'])
  expect(git(['commit', '-m', 'chore: initialize fixture']).status).toBe(0)
  const linked = join(directory, 'linked')
  expect(git(['worktree', 'add', '-b', 'linked', linked]).status).toBe(0)
  await configureHooks(repository, 'install')
  expect((await configureHooks(linked, 'install')).message).toContain('all worktrees')
  expect(git(['config', '--local', '--get', 'core.hooksPath'], linked).stdout).toBe(
    git(['config', '--local', '--get', 'core.hooksPath']).stdout,
  )
  await configureHooks(linked, 'uninstall')
  expect(git(['config', '--local', '--get', 'core.hooksPath']).status).toBe(1)
})

test('a failed partial-staging check restores both worktree and index without modifying files', async () => {
  await symlink(resolve('node_modules'), join(repository, 'node_modules'), 'junction')
  await writeFile(join(repository, 'package.json'), '{"private":true,"type":"module"}\n')
  // This fixture consumes the already-installed tools; it must not reinstall through the junction.
  await writeFile(
    join(repository, 'pnpm-workspace.yaml'),
    'packages:\n  - .\nverifyDepsBeforeRun: false\n',
  )
  for (const file of ['.prettierrc.json', 'lint-staged.config.ts', 'eslint.config.ts']) {
    await copyFile(resolve(file), join(repository, file))
  }

  const source = join(repository, 'fixture.ts')
  await writeFile(source, "export const value = 'initial'\n")
  git([
    'add',
    '.husky',
    'fixture.ts',
    'package.json',
    '.prettierrc.json',
    'lint-staged.config.ts',
    'eslint.config.ts',
  ])
  expect(git(['commit', '-m', 'chore: initialize fixture']).status).toBe(0)
  await configureHooks(repository, 'install')
  await writeFile(source, 'export const value="staged";\n')
  git(['add', 'fixture.ts'])
  await writeFile(source, 'export const value="staged";\nexport const unstaged = true\n')
  const index = git(['show', ':fixture.ts']).stdout
  const working = await readFile(source, 'utf8')
  const stashes = git(['stash', 'list']).stdout

  const result = git(['commit', '-m', 'test: reject unformatted source'])
  expect(result.status, result.stdout + result.stderr).not.toBe(0)
  expect(await readFile(source, 'utf8')).toBe(working)
  expect(git(['show', ':fixture.ts']).stdout).toBe(index)
  expect(git(['stash', 'list']).stdout).toBe(stashes)
}, 60_000)

test('source archives and CI are explicit no-op environments', async () => {
  expect((await configureHooks(directory, 'install')).status).toBe('skipped')
  vi.stubEnv('CI', 'true')
  expect((await configureHooks(repository, 'install')).status).toBe('skipped')
  expect(git(['config', '--local', '--get', 'core.hooksPath']).status).toBe(1)
})
