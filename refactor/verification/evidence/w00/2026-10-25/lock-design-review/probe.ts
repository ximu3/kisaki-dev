import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, sep } from 'node:path'
import { mock } from 'node:test'
import { fileURLToPath } from 'node:url'
import { captureDependencies } from '../../../../../../clients/desktop/app/tools/dev/dependencies'
import { replaceOutput } from '../../../../../../clients/desktop/app/tools/lib/output'

const repository = process.cwd()
const evidence = dirname(fileURLToPath(import.meta.url))
const workspace = await fs.mkdtemp(join(tmpdir(), 'kisaki-lock-review-'))

/** Run only local tools against this probe's isolated workspace and retain their actual output. */
async function execute(command: string, args: string[], cwd: string) {
  return await new Promise<{ code: number | null; output: string }>((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, stdio: 'pipe' })
    let output = ''
    child.stdout.setEncoding('utf8').on('data', (value: string) => {
      output += value
    })
    child.stderr.setEncoding('utf8').on('data', (value: string) => {
      output += value
    })
    child.once('error', reject)
    child.once('close', (code) => resolve({ code, output }))
  })
}

/** Invoke the pinned pnpm that started this probe, without downloading tools or packages. */
async function pnpm(args: string[], cwd: string) {
  const executable = process.argv[2] ?? process.env.npm_execpath
  if (!executable) throw new Error('Supply the installed pnpm CLI path')
  return executable.endsWith('.exe')
    ? await execute(executable, args, cwd)
    : await execute(process.execPath, [executable, ...args], cwd)
}

/** Exercise real Turbo cache restoration with an unchanged copy of the RPC package build. */
async function cacheRestore() {
  const root = join(workspace, 'turbo')
  const source = join(repository, 'clients', 'desktop', 'packages', 'rpc')
  const destination = join(root, 'clients', 'desktop', 'packages', 'rpc')
  const ignored = new Set(['node_modules', '.cache', 'dist', 'out', '.turbo'])
  await fs.mkdir(root, { recursive: true })
  await fs.cp(source, destination, {
    recursive: true,
    filter(path) {
      return !relative(source, path)
        .split(/[\\/]/)
        .some((part) => ignored.has(part))
    },
  })
  for (const file of [
    'package.json',
    'pnpm-lock.yaml',
    'tsconfig.base.json',
    'eslint.config.ts',
    '.prettierrc.json',
    '.gitignore',
  ]) {
    await fs.copyFile(join(repository, file), join(root, file))
  }
  await fs.writeFile(
    join(root, 'pnpm-workspace.yaml'),
    'packages:\n  - clients/desktop/packages/rpc\n',
  )
  await fs.writeFile(
    join(root, 'turbo.json'),
    JSON.stringify({ tasks: { build: { outputs: ['dist/**'] } } }),
  )
  await fs.symlink(join(repository, 'node_modules'), join(root, 'node_modules'), 'junction')
  await fs.symlink(join(source, 'node_modules'), join(destination, 'node_modules'), 'junction')
  const git = await execute('git', ['init', '--quiet'], root)
  assert.equal(git.code, 0, git.output)

  const args = ['exec', 'turbo', 'run', 'build', '--filter=@kisaki3/rpc']
  const first = await pnpm(args, root)
  await fs.writeFile(join(evidence, 'cache-first.log'), first.output)
  assert.equal(first.code, 0, first.output)
  assert.match(first.output, /cache miss/)
  const originalBytes = await fs.readFile(join(destination, 'dist', 'index.d.ts'))
  await fs.rename(join(destination, 'dist'), join(destination, '.cache', 'retained-dist'))
  const lock = join(destination, '.cache', 'build.lock')
  await fs.mkdir(lock)

  const cached = await pnpm(args, root)
  await fs.writeFile(join(evidence, 'cache-locked.log'), cached.output)
  assert.equal(cached.code, 0, cached.output)
  assert.match(cached.output, /cache hit/)
  assert.equal(
    await fs.readFile(join(destination, 'dist', 'index.d.ts'), 'utf8'),
    originalBytes.toString(),
  )
  assert.equal((await fs.stat(lock)).isDirectory(), true)

  const direct = await pnpm(['--filter', '@kisaki3/rpc', 'build'], root)
  await fs.writeFile(join(evidence, 'direct-locked.log'), direct.output)
  assert.notEqual(direct.code, 0)
  assert.match(direct.output, /EEXIST/)

  return {
    firstExit: first.code,
    cachedExit: cached.code,
    cacheHitWithLockPresent: true,
    outputRestoredWithLockPresent: true,
    directBuildExit: direct.code,
    directBuildRejectedByLock: true,
    copiedBuildSha256: createHash('sha256')
      .update(await fs.readFile(join(destination, 'tools', 'build.ts')))
      .digest('hex'),
    originalBuildSha256: createHash('sha256')
      .update(await fs.readFile(join(source, 'tools', 'build.ts')))
      .digest('hex'),
  }
}

/** Force a legal writer/reader interleaving without changing either production helper. */
async function snapshotDuringReplacement() {
  const root = join(workspace, 'reader')
  const member = join(root, 'package')
  const output = join(member, 'dist')
  await fs.mkdir(output, { recursive: true })
  await fs.writeFile(
    join(member, 'package.json'),
    JSON.stringify({
      name: '@kisaki3/fixture',
      type: 'module',
      exports: { '.': { import: './dist/a.js' }, './second': { import: './dist/b.js' } },
    }),
  )
  for (const file of ['a.js', 'b.js'])
    await fs.writeFile(join(output, file), 'export const generation = "old";\n')

  const readFile = fs.readFile
  let replaced = false
  const hook = mock.method(fs, 'readFile', async (...args: Parameters<typeof fs.readFile>) => {
    const value = await readFile(...args)
    if (!replaced && String(args[0]) === join(output, 'a.js')) {
      replaced = true
      await replaceOutput(output, async (candidate) => {
        for (const file of ['a.js', 'b.js'])
          await fs.writeFile(join(candidate, file), 'export const generation = "new";\n')
      })
    }
    return value
  })
  syncBuiltinESMExports()

  try {
    const snapshot = await captureDependencies(
      [{ name: '@kisaki3/fixture', path: member }],
      join(root, 'snapshots'),
      new Map(),
    )
    const first = snapshot.aliases.get('@kisaki3/fixture')
    const second = snapshot.aliases.get('@kisaki3/fixture/second')
    assert.ok(first)
    assert.ok(second)
    const a = await readFile(first, 'utf8')
    const b = await readFile(second, 'utf8')
    assert.equal(replaced, true)
    assert.match(a, /"old"/)
    assert.match(b, /"new"/)
    return {
      scheduledAfterFirstRead: true,
      writerCompletedWithExistingLock: true,
      snapshotAccepted: true,
      firstFile: a.trim(),
      secondFile: b.trim(),
      mixedGenerations: true,
    }
  } finally {
    hook.mock.restore()
    syncBuiltinESMExports()
  }
}

const results = await (async () => {
  try {
    const cache = await cacheRestore()
    const snapshot = await snapshotDuringReplacement()
    return {
      date: '2026-10-25',
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      workspace,
      workspaceRemoved: true,
      cache,
      snapshot,
    }
  } finally {
    const temporary = await fs.realpath(tmpdir())
    const owned = await fs.realpath(workspace)
    const child = relative(temporary, owned)
    assert.ok(!isAbsolute(child) && child.startsWith('kisaki-lock-review-') && !child.includes(sep))
    await fs.rm(owned, { recursive: true, force: true })
  }
})()
await fs.writeFile(join(evidence, 'results.json'), JSON.stringify(results, null, 2) + '\n')
console.info(JSON.stringify(results, null, 2))
