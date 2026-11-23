import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect, onTestFinished } from 'vitest'
import { sql, eq } from 'drizzle-orm'
import { initializeDatabase } from '../../src/main/infrastructure/database'
import type { DatabaseCall } from '../../src/main/infrastructure/database/executor'
import { createEvents } from '../../src/main/infrastructure/events'
import type { TaskFinished } from '@kisaki3/desktop-contracts/events'
import { createTasks } from '../../src/main/features/tasks'
import { taskHistory } from '../../src/main/features/tasks/history'
import { preferenceStorage } from '../../src/main/features/preferences/storage'
import { createAttachments } from '../../src/main/infrastructure/attachments'
import {
  attachmentStorage,
  adoptAttachments,
} from '../../src/main/infrastructure/attachments/storage'
import { collections } from '../../src/main/infrastructure/database/schema/organizers'
import { createResources } from '../../src/main/infrastructure/resources'
import { createPreviews } from '../../src/main/features/appearance/preview'
import { dark } from '@kisaki3/desktop-appearance/defaults'
import type { AppearanceTokens } from '@kisaki3/desktop-contracts/appearance'
import { createImages } from '../../src/main/infrastructure/images'
import { createFonts } from '../../src/main/features/fonts'
import { fontStorage } from '../../src/main/features/fonts/storage'
import { storageOptions } from './database/sample'
import { appRoot } from '../../tools/lib/paths'
import { hostTarget } from '../../tools/lib/targets'
import { loadNative } from '#native'

async function library() {
  const root = await mkdtemp(join(tmpdir(), 'kisaki-runtime-'))
  const options = storageOptions(root)
  const storage = initializeDatabase(options)
  onTestFinished(async () => {
    storage.close()
    await rm(root, { recursive: true, force: true, maxRetries: 4 })
  })
  return { root, storage, options }
}

/** Calls worker-owned operations locally so these tests can inject a failed final checkpoint. */
function dispatch<T extends Record<string, (...args: never[]) => unknown>>(
  operations: T,
): DatabaseCall<T> {
  return (async (name: string, ...args: unknown[]) =>
    operations[name]!(...(args as never[]))) as DatabaseCall<T>
}

test('a failed history commit delivers the actual result to live waiters and only the last checkpoint to later readers', async () => {
  const { storage } = await library()
  const history = taskHistory(storage)
  const events = createEvents()
  const finished: TaskFinished[] = []
  events.on('tasks.finished', (fact) => {
    finished.push(fact)
  })
  const tasks = await createTasks(
    dispatch({
      ...history,
      /** Injects a failure only at the generic terminal-history write. */
      finishTask() {
        throw new Error('Synthetic history write failure')
      },
    }),
    events.publisher('tasks.finished'),
  )
  const entered = Promise.withResolvers<string>()
  const finish = Promise.withResolvers<void>()
  const run = tasks.run(
    { type: 'sample', title: 'Sample', supportsPause: true },
    async (context) => {
      await context.reportResult({ saved: 1 })
      entered.resolve(context.ref.taskRunId)
      await finish.promise
      return { saved: 2 }
    },
  )
  const taskRunId = await entered.promise
  const ref = { taskRunId }
  const wait = tasks.wait(ref)
  const received: string[] = []
  const observation = await tasks.observe(ref, (state) => {
    received.push(state.status)
  })
  await expect(tasks.clearHistory()).resolves.toBe(0)
  finish.resolve()
  await expect(run).rejects.toMatchObject({ code: 'WriteFailed', partialResult: { saved: 2 } })
  expect(await wait).toMatchObject({ status: 'failed', result: { saved: 2 } })
  expect(received).toEqual(['running', 'failed'])
  expect(finished).toMatchObject([
    { taskRunId, status: 'failed', result: { saved: 2 }, error: { code: 'WriteFailed' } },
  ])
  expect(await tasks.get(ref)).toMatchObject({
    status: 'interrupted',
    finishedAt: null,
    result: { saved: 1 },
  })
  expect((await tasks.list({ statuses: ['interrupted'] }, { offset: 0, limit: 1 })).total).toBe(1)
  await observation.dispose()
  await expect(tasks.clearHistory()).resolves.toBe(1)
})

test('a checkpoint honors pause and cancellation while ending observation or waiting leaves the run active', async () => {
  const { storage } = await library()
  const tasks = await createTasks(
    dispatch(taskHistory(storage)),
    createEvents().publisher('tasks.finished'),
  )
  const entered = Promise.withResolvers<string>()
  const proceed = Promise.withResolvers<void>()
  const run = tasks.run(
    { type: 'sample', title: 'Pausable task', supportsPause: true },
    async (context) => {
      entered.resolve(context.ref.taskRunId)
      await proceed.promise
      await context.checkpoint()
      return { done: true }
    },
  )
  const ref = { taskRunId: await entered.promise }
  const paused = Promise.withResolvers<void>()
  const readPaused = () => tasks.list({ statuses: ['paused'] }, { offset: 0, limit: 1 })
  let pausedPage = readPaused()
  const query = tasks.onInvalidated(() => {
    pausedPage = readPaused()
  })
  const observed = await tasks.observe(ref, (value) => {
    if (value.status === 'paused') {
      paused.resolve()
    }
  })
  const cancelWait = new AbortController()
  const waiting = tasks.wait(ref, { signal: cancelWait.signal })
  cancelWait.abort()
  await expect(waiting).rejects.toMatchObject({ code: 'Cancelled' })
  expect((await tasks.pause(ref)).status).toBe('pausing')
  expect((await tasks.resume(ref)).status).toBe('running')
  await tasks.pause(ref)
  proceed.resolve()
  await paused.promise
  expect((await pausedPage).items.map((item) => item.id)).toEqual([ref.taskRunId])
  await query.dispose()
  await observed.dispose()
  const terminal = tasks.wait(ref)
  const failure = expect(run).rejects.toMatchObject({ code: 'Cancelled' })
  expect((await tasks.cancel(ref)).status).toBe('cancelling')
  await failure
  expect((await terminal).status).toBe('cancelled')
  expect((await tasks.resume(ref)).status).toBe('cancelled')
})

test('saves only submitted preference fields and rolls back the entire edit on a stale baseline', async () => {
  const { storage } = await library()
  const api = preferenceStorage(storage)
  storage.db.run(
    sql`update preferences set appearance=json_set(appearance,'$.theme',json('{"broken":true}'))`,
  )
  expect(
    api.changePreferences(
      { appearance: { interfaceScale: 125 } },
      { appearance: { interfaceScale: 100 } },
      undefined,
    ).appearance.theme.status,
  ).toBe('invalid')
  expect(
    storage.db.get(sql`select json_extract(appearance,'$.theme') as original from preferences`),
  ).toEqual({ original: '{"broken":true}' })
  expect(() =>
    api.changePreferences(
      { general: { closeMainWindow: 'quit' }, appearance: { interfaceScale: 130 } },
      { appearance: { interfaceScale: 100 } },
      undefined,
    ),
  ).toThrow('changed')
  expect(api.getPreferences().general.closeMainWindow).toBe('background')
})

test('prepared images and fonts survive independent holds and only adopted font bytes are retained', async () => {
  const { root, storage, options } = await library()
  const resources = createResources()
  const runtime = join(appRoot, 'out/resources', hostTarget())
  const { files, listFontFamilies } = loadNative(options.collationExtension)
  const attachments = createAttachments(
    root,
    files,
    resources,
    {
      async fetch() {
        throw new Error('Unexpected network read')
      },
    },
    dispatch(attachmentStorage(storage)),
  )
  const images = createImages(runtime, attachments, resources)
  const fonts = createFonts(
    runtime,
    attachments,
    resources,
    dispatch(fontStorage(storage)),
    listFontFamilies,
  )
  const source = await images.prepare({ type: 'path', path: join(runtime, 'icons/icon.ico') })
  const cropped = await images.transform(source.resource, {
    rotationDegrees: 90,
    crop: { left: 0, top: 0, width: 8, height: 6 },
  })
  const read = resources.hold(cropped.resource)
  const saving = attachments.forSave(
    [cropped.attachmentId],
    new Map([[cropped.attachmentId, cropped.resource]]),
  )
  await cropped.dispose()
  expect(resources.file(read.resource).mediaType).toBe('image/png')
  expect([cropped.width, cropped.height]).toEqual([8, 6])
  await source.dispose()
  await read.dispose()
  const adoption = await saving
  try {
    expect(await attachments.get(cropped.attachmentId)).toBeNull()
    storage.db.transaction((tx) => {
      adoptAttachments(tx, adoption.records)
      tx.insert(collections)
        .values({
          id: 'sample',
          name: 'Sample',
          primaryImageId: cropped.attachmentId,
          createdAt: 1,
          updatedAt: 1,
        })
        .run()
    })
  } finally {
    await adoption.dispose()
  }
  expect((await attachments.cleanup()).removedCount).toBe(0)
  storage.db.delete(collections).where(eq(collections.id, 'sample')).run()
  expect((await attachments.cleanup()).removedCount).toBe(1)
  const prepared = await fonts.prepare({
    type: 'path',
    path: join(runtime, 'fonts/noto-sans-mono/files/noto-sans-mono-latin-wght-normal.woff2'),
  })
  expect(prepared.metadata.faces[0].weight.max).toBeGreaterThan(
    prepared.metadata.faces[0].weight.min,
  )
  const user = await fonts.import({ name: 'Test font', files: [prepared] })
  await prepared.dispose()
  const open = await fonts.open(user.id)
  const previews = createPreviews(
    ['--font-sans', '--font-mono'],
    async (selection) => {
      if (selection.type !== 'user') {
        return null
      }
      const snapshot = await fonts.open(selection.id)
      return {
        files: snapshot.font.files.map((file) => ({
          metadata: file.metadata,
          resource: snapshot.resources[file.attachmentId]!,
        })),
        dispose: () => snapshot.dispose(),
      }
    },
    () => {},
  )
  const tokens: AppearanceTokens = {
    ...dark,
    '--font-sans': { type: 'user', id: user.id },
    '--font-mono': { type: 'default' },
  }
  const original = await previews.open({ colorScheme: 'dark', tokens })
  await expect(fonts.delete(user.id, { signal: AbortSignal.abort() })).rejects.toThrow()
  expect(await fonts.get(user.id)).toMatchObject({ id: user.id })
  await fonts.delete(user.id)
  await attachments.cleanup()
  expect(await attachments.get(user.files[0].attachmentId)).not.toBeNull()
  await open.dispose()
  expect(
    resources.file(previews.current!.resources['--font-sans']![0]!.resource).size,
  ).toBeGreaterThan(0)
  const replacement = await previews.open({
    colorScheme: 'dark',
    tokens: { ...tokens, '--font-sans': { type: 'default' } },
  })
  await expect(original.update({ colorScheme: 'dark', tokens })).rejects.toMatchObject({
    code: 'InstanceExpired',
  })
  await original.dispose()
  expect(previews.current).toBeDefined()
  await replacement.dispose()
  await attachments.drain()
  expect(await attachments.get(user.files[0].attachmentId)).toBeNull()
  expect((await attachments.cleanup()).removedCount).toBe(0)
})
