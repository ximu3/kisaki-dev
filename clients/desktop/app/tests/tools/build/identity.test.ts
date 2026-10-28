/**
 * @fileoverview Verifies desktop input identities through the locked Turbo task graph in
 * an isolated workspace with real package, lockfile and Git inputs.
 */

import { afterEach, beforeEach, expect, test } from 'vitest'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { readPnpm, run } from '@kisaki3/tooling/process'
import { buildInputIdentity, runtimeFiles } from '../../../tools/build/identity'
import { repositoryRoot } from '../../../tools/lib/paths'

let root: string
const applicationPath = 'clients/desktop/app'
const packagePath = 'clients/desktop/packages/fixture'

/** Write one fixture input without requiring its parent directory to exist already. */
async function writeInput(path: string, contents: string): Promise<void> {
  const target = join(root, path)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, contents)
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'kisaki-build-inputs-'))
  const manifest: { packageManager: string } = JSON.parse(
    await readFile(join(repositoryRoot, 'package.json'), 'utf8'),
  )

  await writeInput(
    'package.json',
    JSON.stringify({
      name: 'identity-fixture',
      private: true,
      packageManager: manifest.packageManager,
    }),
  )
  await writeInput(
    `${applicationPath}/package.json`,
    JSON.stringify({
      name: '@kisaki3/desktop',
      private: true,
      scripts: { build: 'node build.js' },
      dependencies: { '@kisaki3/identity-fixture': 'workspace:*' },
    }),
  )
  await writeInput(
    `${packagePath}/package.json`,
    JSON.stringify({
      name: '@kisaki3/identity-fixture',
      version: '1.0.0',
      scripts: { build: 'node build.js' },
    }),
  )
  for (const file of [
    'turbo.json',
    'pnpm-workspace.yaml',
    '.node-version',
    '.npmrc',
    '.gitignore',
  ]) {
    await copyFile(join(repositoryRoot, file), join(root, file))
  }
  await copyFile(
    join(repositoryRoot, applicationPath, 'turbo.json'),
    join(root, applicationPath, 'turbo.json'),
  )
  await writeInput(`${applicationPath}/src/main/entry.ts`, 'export const value = 1\n')
  await writeInput(`${applicationPath}/config/vite/vite.config.main.ts`, 'export default {}\n')
  await writeInput(`${packagePath}/src/index.ts`, 'export const value = 1\n')
  await writeInput(
    `${packagePath}/config/typescript/tsconfig.lib.json`,
    JSON.stringify({ compilerOptions: { target: 'ES2023' } }),
  )

  // The real package manager records the local dependency edge; no tools are installed here.
  await readPnpm(['install', '--lockfile-only', '--offline', '--ignore-scripts'], root)
  await run('git', ['init', '--quiet'], { cwd: root })
  await run('git', ['config', 'core.autocrlf', 'false'], { cwd: root })
  await run('git', ['add', '.'], { cwd: root })
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
      '--quiet',
      '-m',
      'Record build identity inputs',
    ],
    { cwd: root },
  )
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

test('production source, compiler configuration and global inputs change the build identity', async () => {
  const baseline = await buildInputIdentity({ root })
  expect(baseline).toMatch(/\S/)
  const changes: readonly (readonly [string, string])[] = [
    [`${applicationPath}/src/main/entry.ts`, 'export const value = 2\n'],
    [
      `${applicationPath}/config/vite/vite.config.main.ts`,
      'export default { build: { minify: false } }\n',
    ],
    [`${packagePath}/src/index.ts`, 'export const value = 2\n'],
    [
      `${packagePath}/config/typescript/tsconfig.lib.json`,
      JSON.stringify({ compilerOptions: { target: 'ES2022' } }),
    ],
    ['.node-version', '24.11.2\n'],
    ['.npmrc', 'save-exact=true\nengine-strict=true\nstrict-peer-dependencies=true\nfund=false\n'],
  ]

  for (const [file, contents] of changes) {
    const path = join(root, file)
    const original = await readFile(path)
    try {
      await writeFile(path, contents)

      expect(await buildInputIdentity({ root }), file).not.toBe(baseline)
    } finally {
      await writeFile(path, original)
    }
  }
})

test('documentation, development and packaging inputs do not change the finite build identity', async () => {
  const baseline = await buildInputIdentity({ root })

  for (const file of [
    `${applicationPath}/README.md`,
    `${applicationPath}/assets/icons/README.md`,
    `${applicationPath}/tools/dev/cli.ts`,
    `${applicationPath}/tools/package/cli.ts`,
    `${applicationPath}/electron-builder.yml`,
    `${applicationPath}/config/typescript/tsconfig.tests.json`,
    `${applicationPath}/config/vitest/vitest.config.browser.ts`,
    `${packagePath}/README.md`,
    `${packagePath}/config/typescript/tsconfig.tests.json`,
    `${packagePath}/vitest.config.ts`,
  ]) {
    await writeInput(file, 'non-build fixture input\n')
  }

  expect(await buildInputIdentity({ root })).toBe(baseline)
})

test('generated output stays outside input identity while runtime bytes retain their own digests', async () => {
  const baseline = await buildInputIdentity({ root })
  const runtime = join(root, applicationPath, 'out', 'fixture')
  await writeInput(`${applicationPath}/out/fixture/main/entry.js`, 'first runtime\n')
  await writeInput(`${applicationPath}/out/fixture/build.json`, '{}\n')
  const previous = await runtimeFiles(runtime)

  await writeInput(`${applicationPath}/out/fixture/main/entry.js`, 'second runtime\n')
  for (const owner of [applicationPath, packagePath]) {
    for (const directory of ['dist', 'out', '.cache', '.local']) {
      await writeInput(`${owner}/${directory}/generated.json`, '{}\n')
    }
  }

  expect(await buildInputIdentity({ root })).toBe(baseline)
  const current = await runtimeFiles(runtime)
  expect(Object.keys(current)).toEqual(['main/entry.js'])
  expect(current['main/entry.js']).not.toBe(previous['main/entry.js'])
  expect(current['main/entry.js']).toMatch(/^[a-f0-9]{64}$/)
})

test('declared build environment values contribute to the input identity', async () => {
  const previous = process.env.TSDOWN_IDENTITY_FIXTURE
  try {
    process.env.TSDOWN_IDENTITY_FIXTURE = 'before'
    const baseline = await buildInputIdentity({ root })

    process.env.TSDOWN_IDENTITY_FIXTURE = 'after'

    expect(await buildInputIdentity({ root })).not.toBe(baseline)
  } finally {
    if (previous === undefined) delete process.env.TSDOWN_IDENTITY_FIXTURE
    else process.env.TSDOWN_IDENTITY_FIXTURE = previous
  }
})

test('rejects when the desktop build task is unavailable', async () => {
  await writeInput(
    `${applicationPath}/package.json`,
    JSON.stringify({
      name: 'another-application',
      private: true,
      scripts: { build: 'node build.js' },
    }),
  )

  await expect(buildInputIdentity({ root })).rejects.toThrow()
})
