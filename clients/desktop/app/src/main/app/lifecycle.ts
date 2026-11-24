import { addAbortListener } from 'node:events'
import type { CallOptions } from '@kisaki3/desktop-contracts/operations'
import { setTimeout as delay } from 'node:timers/promises'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { RpcError } from '@kisaki3/desktop-rpc'
import type {
  ApplicationExitApi,
  ApplicationExitResult,
  ApplicationExitState,
} from '@kisaki3/desktop-contracts/app'
import { createSignal } from '../infrastructure/events'
import { waitFor } from '../infrastructure/wait'

const waitPromptDelayMs = 5_000

interface ExitDependencies {
  confirm(signal: AbortSignal): Promise<boolean>
  accept(enabled: boolean): void
  drain(): Promise<void>
  waiting(signal: AbortSignal): Promise<'wait' | 'cancel'>
  release(): Promise<void>
  finish(restart: boolean): void
  fail(message: string): void
}

function exitErrorMessage(cause: unknown): string {
  if (cause instanceof AggregateError && cause.errors.length) {
    return cause.errors.map(exitErrorMessage).join('\n')
  }
  return cause instanceof Error ? cause.message : String(cause)
}

export function createLifecycle(deps: ExitDependencies): ApplicationExitApi {
  const changed = createSignal<ApplicationExitState>()
  let state: ApplicationExitState = { status: 'idle' }
  let current: Promise<ApplicationExitResult> | undefined
  let controller: AbortController | undefined

  function publishState(next: ApplicationExitState) {
    state = next
    changed.emit(next)
  }

  async function requestExit(
    intent: 'quit' | 'restart',
    call?: CallOptions,
  ): Promise<ApplicationExitResult> {
    call?.signal?.throwIfAborted()
    if (current) {
      return waitFor(current, call?.signal)
    }

    const abort = new AbortController()
    controller = abort
    const cancel = call?.signal && addAbortListener(call.signal, () => abort.abort())
    const cancelled = Promise.withResolvers<'cancel'>()
    abort.signal.addEventListener('abort', () => cancelled.resolve('cancel'), { once: true })
    let committed = false
    const stopping = { intent, sessions: [], pendingRecordings: 0, error: null } as const

    async function waitForOwners() {
      const settled = Promise.race([
        deps.drain().then(() => 'finished' as const),
        cancelled.promise,
      ])
      const timer = new AbortController()
      try {
        const first = await Promise.race([
          settled,
          delay(waitPromptDelayMs, 'timeout' as const, { signal: timer.signal }),
        ])
        if (first !== 'timeout') {
          return first
        }
      } finally {
        timer.abort()
      }

      publishState({ ...stopping, status: 'waiting' })
      const prompt = new AbortController()
      try {
        const next = await Promise.race([deps.waiting(prompt.signal), settled])
        if (next !== 'wait') {
          return next
        }
      } finally {
        prompt.abort()
      }
      return settled
    }

    const attempt = async (): Promise<ApplicationExitResult> => {
      try {
        const confirmed =
          !abort.signal.aborted &&
          (await Promise.race([deps.confirm(abort.signal), cancelled.promise.then(() => false)]))
        if (!confirmed || abort.signal.aborted) {
          publishState({ status: 'idle' })
          return { outcome: 'cancelled' }
        }

        deps.accept(false)
        if ((await waitForOwners()) === 'cancel' || abort.signal.aborted) {
          deps.accept(true)
          publishState({ status: 'idle' })
          return { outcome: 'cancelled' }
        }

        committed = true
        publishState({ ...stopping, status: 'exiting' })
        await deps.release()
        deps.finish(intent === 'restart')
        return { outcome: 'exiting' }
      } catch (cause) {
        if (!committed) {
          deps.accept(true)
        }
        const error =
          cause instanceof DesktopError || cause instanceof RpcError
            ? { code: cause.code, message: cause.message }
            : {
                code: 'OperationFailed',
                message: exitErrorMessage(cause),
              }
        publishState({ ...stopping, status: 'failed', error })
        console.error('Application exit failed', cause)
        if (committed) {
          deps.fail(error.message)
        }
        return { outcome: 'failed', error }
      }
    }

    // A closing observer may immediately join or cancel this same attempt.
    current = Promise.resolve()
      .then(attempt)
      .finally(() => {
        cancel?.[Symbol.dispose]()
        if (!committed) {
          current = undefined
        }
        controller = undefined
      })
    publishState({ ...stopping, status: 'closing' })
    return current
  }

  return {
    async getState(call) {
      call?.signal?.throwIfAborted()
      return state
    },
    observe(listener) {
      return changed.observe(listener, state)
    },

    quit: (call) => requestExit('quit', call),
    restart: (call) => requestExit('restart', call),

    async cancel(call) {
      call?.signal?.throwIfAborted()
      if (state.status === 'closing' || state.status === 'waiting') {
        controller?.abort()
        await current
      }
    },
    async continueWaiting(call) {
      call?.signal?.throwIfAborted()
      if (!current) {
        throw new DesktopError('InvalidInput', 'There is no exit in progress')
      }
      return waitFor(current, call?.signal)
    },
  }
}
