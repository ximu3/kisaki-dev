/** @fileoverview Coordinates cancellable exit attempts with actual editing, accepted work and final resource release. */

import { setTimeout as delay } from 'node:timers/promises'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  ApplicationExitApi,
  ApplicationExitResult,
  ApplicationExitState,
} from '@kisaki3/desktop-contracts/app'
import { createSignal } from '../infrastructure/events'

/** Admission and teardown callbacks supplied by the owners of the running application. */
interface ExitDependencies {
  /** Asks the open editors whether the attempt may proceed. */
  confirm(): Promise<boolean>
  /** Closes or restores admission for this exit attempt. */
  accept(enabled: boolean): void
  /** Waits for work accepted by the participating owners. */
  drain(): Promise<void>
  /** Offers a continued wait or cancellation after the wait budget expires. */
  waiting(signal: AbortSignal): Promise<'wait' | 'cancel'>
  /** Releases owners in dependency order after their work has drained. */
  release(): Promise<void>
  /** Requests the chosen process disposition after cleanup succeeds. */
  finish(restart: boolean): void
}

/** Creates one coordinator shared by the tray, windows, development control and restart. */
export function createLifecycle(deps: ExitDependencies): ApplicationExitApi {
  /** Delivers each change of exit phase to its observers. */
  const changed = createSignal<ApplicationExitState>()
  let state: ApplicationExitState = { status: 'idle' }
  let current: Promise<ApplicationExitResult> | undefined
  let controller: AbortController | undefined

  /** Publishes actual progress without creating durable quit plans or task history. */
  function set(next: ApplicationExitState) {
    state = next
    changed.emit(next)
  }

  /** Starts one attempt and returns the same result to concurrent callers and continued waits. */
  function start(intent: 'quit' | 'restart') {
    if (current) {
      return current
    }
    const abort = new AbortController()
    controller = abort
    const stopping = { intent, sessions: [], pendingRecordings: 0, error: null } as const
    set({ ...stopping, status: 'closing' })
    /** Checks editors, drains accepted work and commits only an approved exit. */
    const attempt = async (): Promise<ApplicationExitResult> => {
      if (!(await deps.confirm()) || abort.signal.aborted) {
        set({ status: 'idle' })
        return { outcome: 'cancelled' }
      }
      deps.accept(false)
      try {
        const drained = deps.drain()
        const cancelled = new Promise<'cancel'>((resolve) =>
          abort.signal.addEventListener('abort', () => resolve('cancel'), { once: true }),
        )
        const timer = new AbortController()
        let result: 'finished' | 'cancel' | 'timeout'
        try {
          result = await Promise.race([
            drained.then(() => 'finished' as const),
            cancelled,
            delay(5000, 'timeout' as const, { signal: timer.signal }),
          ])
        } finally {
          timer.abort()
        }
        if (result === 'timeout') {
          set({ ...stopping, status: 'waiting' })
          const prompt = new AbortController()
          try {
            // A disappearing wait must dismiss its prompt even if no one presses a button.
            const next = await Promise.race([
              deps.waiting(prompt.signal),
              cancelled,
              drained.then(() => 'finished' as const),
            ])
            result =
              next === 'wait'
                ? await Promise.race([cancelled, drained.then(() => 'finished' as const)])
                : next
          } finally {
            prompt.abort()
          }
        }
        if (result === 'cancel' || abort.signal.aborted) {
          set({ status: 'idle' })
          deps.accept(true)
          return { outcome: 'cancelled' }
        }
        set({ ...stopping, status: 'exiting' })
        await deps.release()
        deps.finish(intent === 'restart')
        return { outcome: 'exiting' }
      } catch (cause) {
        deps.accept(true)
        const error =
          cause instanceof DesktopError
            ? { code: cause.code, message: cause.message }
            : { code: 'OperationFailed', message: 'The application could not finish closing' }
        set({ ...stopping, status: 'failed', error })
        console.error('Application exit failed', cause)
        return { outcome: 'failed', error }
      }
    }
    current = attempt().finally(() => {
      current = undefined
      controller = undefined
    })
    return current
  }

  return {
    /** Reads the current attempt state. */
    async getState() {
      return state
    },
    /** Delivers the current phase and subsequent progress until disposal. */
    observe(listener) {
      const hold = changed.on(listener)
      listener(state)
      return hold
    },
    /** Requests a normal application quit. */
    quit: () => start('quit'),
    /** Requests the normal close sequence followed by relaunch. */
    restart: () => start('restart'),
    /** Reopens admission when cancellation is still possible. */
    async cancel() {
      if (state.status === 'closing' || state.status === 'waiting') {
        controller?.abort()
      }
    },
    /** Joins the existing attempt without issuing another quit. */
    continueWaiting() {
      if (!current) {
        throw new DesktopError('InvalidInput', 'There is no exit in progress')
      }
      return current
    },
  }
}
