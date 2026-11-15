/** @fileoverview Verifies that a real Turbo cache hit restores an exact public build file set. */

import { expect, onTestFinished, test } from 'vitest'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { readPnpm } from '@kisaki3/tooling/process'

test('a previous input restored from cache leaves no files from the intervening build', async () => {
  const root = process.cwd()
  const directory = await mkdtemp(join(tmpdir(), 'kisaki-output-cache-'))
  onTestFinished(() => rm(directory, { recursive: true, force: true }))
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
    packageManager: string
  }
  const config = JSON.parse(await readFile(join(root, 'turbo.json'), 'utf8')) as {
    tasks: Record<string, unknown>
  }

  const outputModule = pathToFileURL(join(root, 'packages/tooling/src/output.ts')).href
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({
      name: 'cache-consumer',
      private: true,
      type: 'module',
      packageManager: manifest.packageManager,
      scripts: { build: 'node build.mjs', 'prepare:build': 'node prepare.mjs' },
    }),
  )
  await writeFile(join(directory, 'pnpm-workspace.yaml'), 'packages:\n  - .\n')
  await writeFile(join(directory, '.gitignore'), 'dist/\nnode_modules/\n.turbo/\ncalls.log\n')
  await writeFile(join(directory, '.gitattributes'), '* text=auto eol=lf\n')
  await writeFile(
    join(directory, 'turbo.json'),
    JSON.stringify({
      tasks: {
        '//#prepare:build': config.tasks['prepare:build'],
        '//#build': config.tasks.build,
      },
    }),
  )
  await writeFile(
    join(directory, 'prepare.mjs'),
    `import { removeOutputs } from ${JSON.stringify(outputModule)}\nawait removeOutputs(process.cwd(), ['dist'])\n`,
  )
  await writeFile(
    join(directory, 'build.mjs'),
    `import { appendFile, readFile, mkdir, writeFile } from 'node:fs/promises'
const name = await readFile('input.txt', 'utf8')
await mkdir('dist')
await writeFile('dist/' + name + '.js', name)
await appendFile('calls.log', name + '\\n')
`,
  )
  await writeFile(join(directory, 'input.txt'), 'a')
  await readPnpm(['install', '--lockfile-only', '--offline', '--ignore-scripts'], directory)

  /** Promise-based command runner for the isolated cache-restoration workspace. */
  const execute = promisify(execFile)
  const options = { cwd: directory, windowsHide: true, encoding: 'utf8' as const }
  await execute('git', ['init', '--quiet'], options)
  await execute('git', ['add', '.'], options)
  await execute(
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
      '--quiet',
      '-m',
      'Cache fixture',
    ],
    options,
  )

  for (const name of ['a', 'b', 'a']) {
    await writeFile(join(directory, 'input.txt'), name)
    await execute(
      process.execPath,
      [resolve(root, 'node_modules/turbo/bin/turbo'), 'run', 'build', '--cache=local:rw'],
      options,
    )
    expect(await readdir(join(directory, 'dist'))).toEqual([`${name}.js`])
  }
  expect(await readFile(join(directory, 'calls.log'), 'utf8')).toBe('a\nb\n')
}, 30_000)
