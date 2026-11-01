/** @fileoverview Verifies the actual Turbo graph and affected desktop engineering checks. */

import { expect, test } from 'vitest'
import { execFile } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'
import { readPnpm } from '@kisaki3/tooling/process'

test('verification tasks prepare the artifacts they actually consume', async () => {
  const plan = JSON.parse(
    await readPnpm(
      [
        'exec',
        'turbo',
        'run',
        'test:native',
        'test:e2e',
        'test:dev',
        'test:artifacts',
        'root:test:consumers',
        '--dry=json',
      ],
      process.cwd(),
    ),
  ) as { tasks: { taskId: string; dependencies: string[] }[] }
  const dependencies = new Map(plan.tasks.map((task) => [task.taskId, task.dependencies]))
  const reaches = (task: string, prerequisite: string): boolean =>
    (dependencies.get(task) ?? []).some(
      (dependency) => dependency === prerequisite || reaches(dependency, prerequisite),
    )

  expect(reaches('@kisaki3/desktop#test:native', '@kisaki3/desktop#build:native')).toBe(true)
  expect(reaches('@kisaki3/desktop#test:e2e', '@kisaki3/desktop#build:fixture')).toBe(true)
  expect(reaches('@kisaki3/desktop#test:dev', '@kisaki3/desktop#build:native')).toBe(true)
  expect(reaches('@kisaki3/desktop#test:artifacts', '@kisaki3/desktop#package:fixture')).toBe(true)
  expect(reaches('//#root:test:consumers', '@kisaki3/desktop-appearance#pack')).toBe(true)
})

test(
  'documentation and suite-only edits select only the relevant engineering verification',
  { timeout: 60_000 },
  async ({ signal }) => {
    const root = process.cwd()
    const directory = await mkdtemp(join(tmpdir(), 'kisaki-task-inputs-'))
    const execute = promisify(execFile)
    const options = {
      signal,
      cwd: directory,
      encoding: 'utf8' as const,
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
    }
    const cases: { path: string; desktop: string[]; consumers?: boolean }[] = [
      { path: 'refactor/README.md', desktop: [] },
      { path: '.github/workflows/pr-title.yml', desktop: [] },
      { path: 'clients/desktop/packages/desktop-appearance/README.md', desktop: [] },
      {
        path: 'clients/desktop/packages/desktop-appearance/src/styles.css',
        desktop: [],
        consumers: true,
      },
      { path: 'tests/desktop/consumers/appearance.test.ts', desktop: [], consumers: true },
      { path: 'clients/desktop/app/config/typescript/tsconfig.tests.json', desktop: [] },
      { path: 'clients/desktop/app/tests/e2e/windows.test.ts', desktop: ['test:e2e'] },
      { path: 'clients/desktop/app/tests/tools/dev/session.test.ts', desktop: ['test:dev'] },
      { path: 'clients/desktop/app/tests/artifacts/desktop.test.ts', desktop: ['test:artifacts'] },
      {
        path: 'clients/desktop/app/electron-builder.yml',
        desktop: ['test:artifacts'],
      },
      { path: 'LICENSE', desktop: ['test:artifacts'] },
      {
        path: 'clients/desktop/app/tests/fixtures/runtime/src/renderer/windows/main/entry.tsx',
        desktop: ['test:artifacts', 'test:dev', 'test:e2e'],
      },
      {
        path: 'clients/desktop/app/native/src/lib.rs',
        desktop: ['test:artifacts', 'test:dev', 'test:e2e', 'test:native'],
      },
    ]
    try {
      const members = JSON.parse(
        await readPnpm(['list', '--recursive', '--depth', '-1', '--json'], root),
      ) as { path: string }[]
      const files = new Set([
        'package.json',
        'pnpm-workspace.yaml',
        'pnpm-lock.yaml',
        'turbo.json',
        '.gitignore',
        '.node-version',
        '.npmrc',
        'clients/desktop/app/turbo.json',
        'config/turbo/verification.graphql',
        ...members.map((member) => join(relative(root, member.path), 'package.json')),
      ])
      for (const file of files) {
        await mkdir(dirname(join(directory, file)), { recursive: true })
        await copyFile(join(root, file), join(directory, file))
      }
      for (const item of cases) {
        await mkdir(dirname(join(directory, item.path)), { recursive: true })
        await writeFile(join(directory, item.path), 'initial fixture input\n')
      }
      await execute('git', ['init', '--initial-branch=main'], options)
      await execute('git', ['add', '.'], options)
      const commit = [
        '-c',
        'core.hooksPath=',
        '-c',
        'commit.gpgSign=false',
        '-c',
        'user.name=Fixture',
        '-c',
        'user.email=fixture@example.invalid',
        'commit',
        '-m',
        'Fixture input',
      ]
      await execute('git', commit, options)
      const variables = join(directory, '.local/verification-refs.json')
      await mkdir(dirname(variables), { recursive: true })
      await writeFile(variables, JSON.stringify({ base: 'HEAD^', head: 'HEAD' }))
      for (const item of cases) {
        await writeFile(join(directory, item.path), 'changed fixture input\n')
        await execute('git', ['add', item.path], options)
        await execute('git', commit, options)
        const { stdout } = await execute(
          process.execPath,
          [
            resolve(root, 'node_modules/turbo/bin/turbo'),
            'query',
            'config/turbo/verification.graphql',
            '--variables',
            variables,
          ],
          options,
        )
        const report = JSON.parse(stdout) as {
          errors?: unknown[]
          data: {
            affectedTasks: {
              items: {
                name: string
                fullName: string
                command: string | null
                package: { name: string }
              }[]
            }
          }
        }
        expect(report.errors, item.path).toBeUndefined()
        const selected = report.data.affectedTasks.items
          .filter(
            (task) =>
              task.command !== null &&
              task.package.name === '@kisaki3/desktop' &&
              task.name.startsWith('test:'),
          )
          .map((task) => task.name)
          .sort()
        expect(selected, item.path).toEqual([...item.desktop].sort())
        expect(
          report.data.affectedTasks.items.some(
            (task) => task.command !== null && task.fullName === '//#root:test:consumers',
          ),
          item.path,
        ).toBe(item.consumers ?? false)
      }
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  },
)
