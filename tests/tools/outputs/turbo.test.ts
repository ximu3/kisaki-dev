import { expect, test } from 'vitest'
import {
  cp,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { acquireOutputs, readPnpm, run, runTurbo } from '../../../tools/outputs'

test('cache restoration observes the same output lock as the real package builder', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'kisaki-output-cache-')))
  const source = resolve('clients/desktop/packages/rpc')
  const project = join(root, 'clients', 'desktop', 'packages', 'rpc')
  const ignored = new Set(['node_modules', 'out', 'dist', '.cache', '.turbo'])
  try {
    await cp(source, project, {
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
      'pnpm-workspace.yaml',
      'tsconfig.base.json',
      '.gitignore',
    ]) {
      await copyFile(resolve(file), join(root, file))
    }
    await cp(resolve('tools/outputs'), join(root, 'tools', 'outputs'), { recursive: true })
    await writeFile(
      join(root, 'turbo.json'),
      JSON.stringify({
        globalDependencies: ['tools/outputs/**'],
        globalPassThroughEnv: ['KISAKI_OUTPUT_ACCESS'],
        tasks: { build: { outputs: ['dist/**'] } },
      }),
    )
    await symlink(resolve('node_modules'), join(root, 'node_modules'), 'junction')
    await symlink(join(source, 'node_modules'), join(project, 'node_modules'), 'junction')
    await run('git', ['init', '--quiet'], { cwd: root })

    const tasks = ['run', 'build', '--filter=@kisaki3/rpc']
    await runTurbo(tasks, { root })
    const expected = await readFile(join(project, 'dist', 'index.d.ts'), 'utf8')
    await mkdir(join(project, '.cache'), { recursive: true })
    await rename(join(project, 'dist'), join(project, '.cache', 'retained-dist'))
    const plan: { tasks: { cache: { status: string } }[] } = JSON.parse(
      await readPnpm(['exec', 'turbo', ...tasks, '--dry=json'], root),
    )
    expect(plan.tasks[0]?.cache.status).toBe('HIT')

    const reader = await acquireOutputs([{ project, mode: 'use', read: ['dist'] }], { root })
    try {
      await expect(runTurbo(tasks, { root })).rejects.toMatchObject({ code: 'OUTPUT_IN_USE' })
      await expect(readFile(join(project, 'dist', 'index.d.ts'))).rejects.toMatchObject({
        code: 'ENOENT',
      })
    } finally {
      await reader.close()
    }

    await runTurbo(tasks, { root })
    expect(await readFile(join(project, 'dist', 'index.d.ts'), 'utf8')).toBe(expected)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}, 30_000)
