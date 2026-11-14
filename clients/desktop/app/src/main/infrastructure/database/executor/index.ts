/** @fileoverview Owns a serial SQLite worker and its ordered handoff of preferences and locale changes. */

import { Worker } from 'node:worker_threads'
import type { DatabaseOptions, Storage } from '../initialize'
import type { UiLocale } from '@kisaki3/desktop-contracts/i18n'

/** Storage initialization and every operation complete before the next command is accepted. */
export type DatabaseCommand =
  | { type: 'preferences' }
  | { type: 'adopt-locale'; locale: UiLocale }
  | { type: 'close' }

/** The actual decoded singleton row returned by the database. */
export type PreferenceRow = Storage['preferences']['$inferSelect']

/** Opens the deployed worker, returning a handle only after schema and preferences are ready. */
export async function openDatabaseExecutor(entry: URL, options: DatabaseOptions) {
  const worker = new Worker(entry, { workerData: options })
  const ready = Promise.withResolvers<void>()
  const exited = Promise.withResolvers<void>()
  void exited.promise.catch(() => undefined)
  let pending: PromiseWithResolvers<PreferenceRow | undefined> | undefined
  let failure: Error | undefined
  let closeAcknowledged = false
  let closing: Promise<void> | undefined
  let queue = Promise.resolve()

  /** Delivers an unexpected worker exit to its readiness and currently outstanding request. */
  const fail = (error: Error) => {
    failure = error
    ready.reject(error)
    pending?.reject(error)
  }
  worker.on('error', fail)
  worker.on(
    'message',
    (message: { ready?: boolean; closed?: boolean; value?: PreferenceRow; error?: Error }) => {
      if (message.closed) {
        closeAcknowledged = true
      }
      if (message.ready) {
        ready.resolve()
      } else if (message.error) {
        pending?.reject(message.error)
      } else {
        pending?.resolve(message.value)
      }
    },
  )
  worker.once('exit', (code) => {
    if (code !== 0 || !closeAcknowledged) {
      fail(failure ?? new Error('Database worker exited with status ' + code))
    }
    if (failure) {
      exited.reject(failure)
    } else {
      exited.resolve()
    }
  })

  try {
    await ready.promise
  } catch (cause) {
    await worker.terminate()
    throw cause
  }

  /** Preserves FIFO order, lets later requests continue after a rejected operation and drains before closing. */
  function request(command: DatabaseCommand): Promise<PreferenceRow | undefined> {
    if (closing) {
      return Promise.reject(new Error('Database executor is closing'))
    }
    const result = queue.then(async () => {
      if (failure) {
        throw failure
      }
      pending = Promise.withResolvers<PreferenceRow | undefined>()
      try {
        worker.postMessage(command)
        return await pending.promise
      } finally {
        pending = undefined
      }
    })
    queue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  return {
    /** Returns the initialized preference row for main's effective-language selection. */
    async readPreferences() {
      return (await request({ type: 'preferences' }))!
    },
    /** Resolves after the comparator and all name indexes have committed the effective language. */
    async adoptLocale(locale: UiLocale) {
      await request({ type: 'adopt-locale', locale })
    },
    /** Drains accepted work, closes SQLite and waits for the worker to exit. */
    close() {
      return (closing ??= request({ type: 'close' }).then(
        async () => {
          await exited.promise
        },
        async (error: unknown) => {
          await exited.promise
          throw error
        },
      ))
    },
  }
}
