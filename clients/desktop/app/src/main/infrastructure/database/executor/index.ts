import { rethrowAfterRelease } from '../../release'
import { Worker } from 'node:worker_threads'
import type { DatabaseOptions, Storage } from '../initialize'
import type { UiLocale } from '@kisaki3/desktop-contracts/i18n'
import { DesktopError, type ErrorSummary } from '@kisaki3/desktop-contracts/errors'

export type DatabaseCommand =
  | { type: 'adopt-locale'; locale: UiLocale }
  | { type: 'operation'; name: string; args: readonly unknown[] }
  | { type: 'close' }

export type DatabaseCall<Operations> = <K extends keyof Operations & string>(
  name: K,
  ...args: Operations[K] extends (...args: infer A) => unknown ? A : never
) => Promise<Operations[K] extends (...args: never[]) => infer R ? R : never>

export type PreferenceRow = Storage['preferences']['$inferSelect']

export async function openDatabaseExecutor<Operations = never>(
  entry: URL,
  options: DatabaseOptions,
) {
  const worker = new Worker(entry, { workerData: options })
  const ready = Promise.withResolvers<void>()
  const exited = Promise.withResolvers<void>()
  void exited.promise.catch(() => undefined)
  let pending: PromiseWithResolvers<unknown> | undefined
  let failure: Error | undefined
  let closeAcknowledged = false
  let closing: Promise<void> | undefined
  let queue = Promise.resolve()

  const fail = (error: Error) => {
    failure = error
    ready.reject(error)
    pending?.reject(error)
  }
  worker.on('error', fail)
  worker.on(
    'message',
    (message: {
      ready?: boolean
      closed?: boolean
      value?: unknown
      error?: Error
      failure?: ErrorSummary
    }) => {
      if (message.closed) {
        closeAcknowledged = true
      }
      if (message.ready) {
        ready.resolve()
      } else if (message.failure) {
        pending?.reject(new DesktopError(message.failure.code, message.failure.message))
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
    return rethrowAfterRelease(cause, () => worker.terminate())
  }

  function request(command: DatabaseCommand): Promise<unknown> {
    if (closing) {
      return Promise.reject(new Error('Database executor is closing'))
    }
    const result = queue.then(async () => {
      if (failure) {
        throw failure
      }
      pending = Promise.withResolvers<unknown>()
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
    call: ((name: string, ...args: unknown[]) =>
      request({ type: 'operation', name, args })) as DatabaseCall<Operations>,
    async adoptLocale(locale: UiLocale) {
      await request({ type: 'adopt-locale', locale })
    },
    close(this: void) {
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
