/**
 * @fileoverview Verifies real Turbo task inputs, cache policy and affected verification
 * scope using isolated Git changes.
 */

import { expect, test } from 'vitest'
import { execFile } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'
import { readPnpm } from '@kisaki3/tooling/process'

interface PlannedTask {
  taskId: string
  task: string
  command: string
  inputs: Record<string, string>
  resolvedTaskDefinition: { cache: boolean; env: string[] }
}

test('the actual task graph excludes generated inputs and always executes runtime validation', async () => {
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [
      resolve('node_modules/turbo/bin/turbo'),
      'run',
      'build',
      'typecheck',
      'lint',
      'check:boundaries',
      'test',
      'root:test',
      'check:package',
      'test:native',
      'test:browser',
      'test:e2e',
      'test:dev',
      'test:performance',
      'test:artifacts',
      'package',
      'dev',
      'clean',
      '--dry=json',
    ],
    { cwd: process.cwd(), encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
  )

  const plan = JSON.parse(stdout) as { tasks: PlannedTask[] }
  expect(
    plan.tasks.find((task) => task.taskId === '@kisaki3/desktop-contracts#test')
      ?.resolvedTaskDefinition.cache,
  ).toBe(true)
  for (const owner of ['desktop', 'tooling', 'extension-cli']) {
    expect(
      plan.tasks.find((task) => task.taskId === `@kisaki3/${owner}#test`)?.resolvedTaskDefinition
        .cache,
      owner,
    ).toBe(false)
  }
  const boundary = plan.tasks.find((task) => task.taskId === '//#check:boundaries')!
  expect(boundary).toBeDefined()
  expect(
    Object.keys(boundary.inputs).some((file) => file.startsWith('clients/desktop/app/src/')),
  ).toBe(true)
  expect(
    Object.keys(boundary.inputs).some((file) => file.startsWith('packages/tooling/src/')),
  ).toBe(true)

  const desktopPackage = plan.tasks.find((task) => task.taskId === '@kisaki3/desktop#package')!
  expect(desktopPackage.resolvedTaskDefinition.env).toContain('KISAKI_MAC_SIGNING_IDENTITY')

  for (const name of ['build', 'dev', 'package', 'test:dev']) {
    const task = plan.tasks.find((task) => task.taskId === `@kisaki3/desktop#${name}`)!
    expect(task.resolvedTaskDefinition.env, name).toContain('MACOSX_DEPLOYMENT_TARGET')
    expect(task.resolvedTaskDefinition.env, name).toContain('TSDOWN_*')
  }

  const liveTasks = new Set([
    'dev',
    'package',
    'clean',
    'test:native',
    'test:browser',
    'test:e2e',
    'test:dev',
    'test:performance',
    'test:artifacts',
  ])

  for (const task of plan.tasks) {
    const generated = Object.keys(task.inputs).filter((file) =>
      /(^|\/)(node_modules|out|dist|\.cache|\.turbo|\.local|target)\//.test(file),
    )
    expect(generated, task.taskId).toEqual([])

    if (task.command === '<NONEXISTENT>') {
      continue
    }
    if (liveTasks.has(task.task)) {
      expect(task.resolvedTaskDefinition.cache, task.taskId).toBe(false)
    }
  }
})

test(
  'affected tasks follow verification inputs without promoting documentation or test edits to full desktop acceptance',
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
    const cases = [
      { path: 'refactor/README.md', desktop: [], consumers: false },
      { path: '.github/workflows/pr-title.yml', desktop: [], consumers: false },
      {
        path: 'clients/desktop/packages/desktop-contracts/config/typescript/tsconfig.tests.json',
        desktop: [],
        consumers: false,
      },
      {
        path: 'clients/desktop/packages/desktop-contracts/vitest.config.ts',
        desktop: [],
        consumers: false,
      },
      {
        path: 'clients/desktop/app/config/typescript/tsconfig.tests.json',
        desktop: [],
        consumers: false,
      },
      {
        path: 'clients/desktop/app/electron-builder.yml',
        desktop: ['package', 'test:artifacts'],
        consumers: false,
      },
      { path: 'LICENSE', desktop: ['package', 'test:artifacts'], consumers: false },
      {
        path: 'clients/desktop/packages/ui/tests/browser/controls.test.tsx',
        desktop: [],
        consumers: false,
        packageTest: '@kisaki3/ui#test:browser',
      },
      {
        path: 'clients/desktop/app/tests/e2e/windows.test.ts',
        desktop: ['test:e2e'],
        consumers: false,
      },
      { path: 'tests/desktop/consumers/packages.test.ts', desktop: [], consumers: true },
      {
        path: 'clients/desktop/packages/desktop-contracts/src/development.test.ts',
        desktop: [],
        consumers: false,
        packageTest: '@kisaki3/desktop-contracts#test',
      },
      {
        path: 'clients/desktop/packages/extension-cli/tests/integration/development-application.test.ts',
        desktop: [],
        consumers: false,
        packageTest: '@kisaki3/extension-cli#test',
      },
      { path: 'clients/desktop/app/tools/dev/session.ts', desktop: ['test:dev'], consumers: false },
      {
        path: 'clients/desktop/app/src/renderer/windows/main/entry.tsx',
        desktop: ['package', 'test:artifacts', 'test:e2e'],
        consumers: false,
      },
      {
        path: 'clients/desktop/packages/ui/src/components/button.tsx',
        desktop: ['package', 'test:artifacts', 'test:e2e'],
        consumers: true,
      },
      {
        path: 'clients/desktop/packages/ui/config/typescript/tsconfig.lib.json',
        desktop: ['package', 'test:artifacts', 'test:dev', 'test:e2e'],
        consumers: true,
      },
      {
        path: 'clients/desktop/app/native/src/lib.rs',
        desktop: ['package', 'test:artifacts', 'test:dev', 'test:e2e', 'test:native'],
        consumers: false,
      },
      {
        path: 'clients/desktop/packages/extension-cli/src/extension.ts',
        desktop: ['package', 'test:artifacts', 'test:dev', 'test:e2e'],
        consumers: true,
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
        'clients/desktop/packages/ui/turbo.json',
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
      const lintQuery = join(directory, '.local/lint.graphql')
      await writeFile(
        lintQuery,
        (await readFile(join(root, 'config/turbo/verification.graphql'), 'utf8')).replace(
          /tasks:\s*\[[\s\S]*?\]/,
          'tasks: ["lint", "root:lint", "check:boundaries"]',
        ),
      )

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
                package: { name: string; path: string }
                reason: { __typename: string }
              }[]
            }
          }
        }
        expect(report.errors, item.path).toBeUndefined()

        const tasks = report.data.affectedTasks.items.filter((task) => task.command !== null)
        const desktop = tasks
          .filter(
            (task) =>
              task.package.name === '@kisaki3/desktop' &&
              (task.name.startsWith('test:') || task.name === 'package'),
          )
          .map((task) => task.name)
          .sort()
        expect(desktop, item.path).toEqual(item.desktop)

        if (item.packageTest) {
          expect(
            tasks.some((task) => task.fullName === item.packageTest),
            item.path,
          ).toBe(true)

          const { stdout: lintOutput } = await execute(
            process.execPath,
            [
              resolve(root, 'node_modules/turbo/bin/turbo'),
              'query',
              lintQuery,
              '--variables',
              variables,
            ],
            options,
          )

          const lintReport = JSON.parse(lintOutput) as typeof report
          expect(lintReport.errors).toBeUndefined()
          expect(
            lintReport.data.affectedTasks.items
              .filter((task) => task.command !== null && task.name !== 'build')
              .map((task) => task.fullName)
              .sort(),
            item.path,
          ).toEqual([item.packageTest.replace(/#test(?::browser)?$/, '#lint')])
          for (const task of lintReport.data.affectedTasks.items.filter(
            (task) => task.name === 'build',
          )) {
            expect(task.reason.__typename, task.fullName).toBe('TaskAllChanged')
          }
        }

        if (item.path.includes('/src/renderer/')) {
          // Unchanged build prerequisites remain in the plan without selecting other desktop suites.
          expect(
            tasks.some(
              (task) => task.name === 'build' && task.reason.__typename === 'TaskAllChanged',
            ),
          ).toBe(true)
          expect(
            tasks.some((task) =>
              ['TaskGlobalFileChanged', 'TaskGlobalDepsChanged'].includes(task.reason.__typename),
            ),
          ).toBe(false)
        }

        expect(
          tasks.some(
            (task) =>
              task.fullName === '//#desktop:packages:test:consumers:prepared' ||
              (task.name === 'check:package' &&
                task.package.path.startsWith('clients/desktop/packages/')),
          ),
          item.path,
        ).toBe(item.consumers)

        if (item.path.includes('/tests/browser/')) {
          const { stdout: dryRun } = await execute(
            process.execPath,
            [
              resolve(root, 'node_modules/turbo/bin/turbo'),
              'run',
              'test:browser',
              'test:e2e',
              'test:dev',
              'test:performance',
              'test:native',
              'test:artifacts',
              'package',
              '--affected',
              '--dry=json',
              '--filter=@kisaki3/ui',
            ],
            {
              ...options,
              env: { ...process.env, TURBO_SCM_BASE: 'HEAD^', TURBO_SCM_HEAD: 'HEAD' },
            },
          )

          const plan = JSON.parse(dryRun) as { tasks: PlannedTask[] }
          expect(
            plan.tasks
              .filter(
                (task) =>
                  task.taskId.startsWith('@kisaki3/ui#') && task.command !== '<NONEXISTENT>',
              )
              .map((task) => task.task)
              .sort(),
          ).toEqual(['build', 'test:browser'])
        }
      }

      await writeFile(join(directory, '.node-version'), 'changed toolchain input\n')
      await execute('git', ['add', '.node-version'], options)
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

      const complete = JSON.parse(stdout) as {
        data: { affectedTasks: { items: { reason: { __typename: string } }[] } }
      }
      expect([
        ...new Set(complete.data.affectedTasks.items.map((task) => task.reason.__typename)),
      ]).toEqual(['TaskGlobalDepsChanged'])
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  },
)
