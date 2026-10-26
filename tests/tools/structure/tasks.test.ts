import { expect, test } from 'vitest'
import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

interface PlannedTask {
  taskId: string
  task: string
  directory: string
  command: string
  inputs: Record<string, string>
  resolvedTaskDefinition: { cache: boolean }
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
      'test:root',
      'test:consumers',
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
  const plan: { tasks: PlannedTask[] } = JSON.parse(stdout)
  const boundary = plan.tasks.find((task) => task.taskId === '//#check:boundaries')!
  expect(boundary).toBeDefined()
  expect(
    Object.keys(boundary.inputs).some((file) => file.startsWith('clients/desktop/app/src/')),
  ).toBe(true)
  expect(
    Object.keys(boundary.inputs).some((file) => file.startsWith('packages/tooling/src/')),
  ).toBe(true)

  for (const task of plan.tasks) {
    const generated = Object.keys(task.inputs).filter((file) =>
      /(^|\/)(node_modules|out|dist|\.cache|\.turbo|\.local|target)\//.test(file),
    )
    expect(generated, task.taskId).toEqual([])
    if (task.command === '<NONEXISTENT>') continue
    if (task.task.startsWith('test') || ['package', 'dev', 'clean'].includes(task.task)) {
      expect(task.resolvedTaskDefinition.cache, task.taskId).toBe(false)
    }
    if (task.directory.startsWith('packages/')) expect(task.task, task.taskId).not.toBe('build')
  }
})
