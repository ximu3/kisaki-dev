/** @fileoverview Owns admitted task executions, cooperative controls, observation and independent durable history. */

import { randomUUID } from 'node:crypto'
import { addAbortListener } from 'node:events'
import { DesktopError, type ErrorSummary } from '@kisaki3/desktop-contracts/errors'
import { parseJsonValue, type JsonValue } from '@kisaki3/desktop-contracts/json'
import {
  parseListOptions,
  type CallOptions,
  type Listener,
} from '@kisaki3/desktop-contracts/operations'
import {
  isTaskTerminal,
  parseTaskDefinition,
  parseTaskProgress,
  parseTaskQuery,
  type TaskRun,
  type TaskHistoryFilter,
  type TaskRunRef,
  type TaskRunStatus,
  type TaskState,
  type TasksApi,
  type TaskTerminalRun,
} from '@kisaki3/desktop-contracts/tasks'
import type { TaskFinished, NativeEventPublisher } from '@kisaki3/desktop-contracts/events'
import type { DatabaseCall } from '../../infrastructure/database/executor'
import { createSignal } from '../../infrastructure/events'
import type { taskHistory } from './history'

/** Controls offered for the execution's current state. */
function state(
  id: string,
  status: TaskRunStatus,
  supportsPause = false,
  progress: TaskState['progress'] = null,
): TaskState {
  return {
    taskRunId: id,
    status,
    progress,
    canPause: supportsPause && (status === 'running' || status === 'queued'),
    canResume: status === 'paused' || status === 'pausing',
    canCancel: !isTaskTerminal(status) && status !== 'cancelling',
  }
}

/** Waits only for this caller, releasing the abort listener when the wait ends. */
async function waitFor<T>(result: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) {
    return result
  }
  signal.throwIfAborted()
  const cancelled = Promise.withResolvers<never>()
  const listener = addAbortListener(signal, () =>
    cancelled.reject(new DesktopError('Cancelled', 'The wait was cancelled')),
  )
  try {
    return await Promise.race([result, cancelled.promise])
  } finally {
    listener[Symbol.dispose]()
  }
}

/** Running control state survives release of every observing window. */
function execution(id: string, supportsPause: boolean) {
  /** Publishes lightweight changes for this specific live execution. */
  const changed = createSignal<TaskState>()
  const controller = new AbortController()
  const ended = Promise.withResolvers<TaskTerminalRun>()
  let current = state(id, 'queued', supportsPause)
  let gate: PromiseWithResolvers<void> | undefined

  /** Publishes an ordered control snapshot and leaves progress in memory. */
  function set(status: TaskRunStatus, progress = current.progress) {
    current = state(id, status, supportsPause, progress)
    changed.emit(current)
    if (isTaskTerminal(status)) {
      changed.clear()
    }
    return current
  }

  return {
    ended,
    controller,
    set,
    /** Reads the last acknowledged control state. */
    get current() {
      return current
    },
    /** Attaches before handing off the current snapshot so the caller can dispose independently. */
    observe(listener: Listener<TaskState>) {
      const subscription = changed.on(listener)
      try {
        listener(current)
        return subscription
      } catch (error) {
        void subscription.dispose()
        throw error
      }
    },
    /** Records a pause request until the next actual business checkpoint. */
    pause() {
      if (current.canPause) {
        gate = Promise.withResolvers()
        set('pausing')
      }
      return current
    },
    /** Releases a reached pause or withdraws one still pending. */
    resume() {
      if (gate) {
        gate.resolve()
        gate = undefined
        set('running')
      }
      return current
    },
    /** Signals the business operation and wakes a pending pause for cleanup. */
    cancel() {
      if (current.canCancel) {
        set('cancelling')
        controller.abort(new DesktopError('Cancelled', 'The task was cancelled'))
        gate?.resolve()
        gate = undefined
      }
      return current
    },
    /** Honors pause and cancellation at an owner-selected safe point. */
    async checkpoint(this: void) {
      controller.signal.throwIfAborted()
      while (gate) {
        set('paused')
        await gate.promise
        controller.signal.throwIfAborted()
      }
    },
  }
}

/** Creates the application's task API after recovering history left by the previous process. */
export async function createTasks(
  call: DatabaseCall<ReturnType<typeof taskHistory>>,
  finished: NativeEventPublisher<'tasks.finished'>,
) {
  const active = new Map<string, ReturnType<typeof execution>>()
  /** Notifies history readers at creation, durable checkpoints, completion and cleanup. */
  const invalidated = createSignal<void>()
  let accepting = true
  await call('interruptTasks')

  /** Reads terminal history after an execution has released its live context. */
  async function retained(id: string): Promise<TaskTerminalRun> {
    const row = await call('getTask', id, null)
    if (!row) {
      throw new DesktopError('NotFound', 'The task history does not exist')
    }
    return { ...row, status: row.status as TaskTerminalRun['status'] }
  }

  /** Applies a control to the owned run or returns the unchanged historical terminal state. */
  async function control(id: string, action: 'pause' | 'resume' | 'cancel', options?: CallOptions) {
    options?.signal?.throwIfAborted()
    const live = active.get(id)
    return live ? live[action]() : state(id, (await retained(id)).status)
  }

  /** Protects admitted work and publishes every committed history deletion. */
  async function clearHistory(filter: TaskHistoryFilter, id?: string) {
    const removed = await call('clearTasks', filter, [...active.keys()], id)
    if (removed) {
      invalidated.emit()
    }
    return removed
  }

  const api: TasksApi = {
    /** Admits one managed execution and returns its result after history and cleanup finish. */
    async run(definition, execute, options) {
      options?.signal?.throwIfAborted()
      if (!accepting) {
        throw new DesktopError('Busy', 'The application is closing')
      }
      const input = parseTaskDefinition(definition)
      const id = randomUUID()
      const live = execution(id, input.supportsPause ?? false)
      const now = Date.now()
      const record: TaskRun = {
        id,
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        status: 'running',
        input: input.input ?? null,
        result: null,
        error: null,
        createdAt: now,
        startedAt: now,
        finishedAt: null,
      }
      const cancel = options?.signal && addAbortListener(options.signal, () => live.cancel())
      active.set(id, live)
      let result: JsonValue = null
      let status: TaskTerminalRun['status'] = 'completed'
      let error: ErrorSummary | null = null
      let started = false
      let checkpointFailure: DesktopError | undefined
      let returned: Awaited<ReturnType<typeof execute>>
      try {
        await call('startTask', record)
        started = true
        if (live.current.status === 'queued') {
          live.set('running')
        }
        invalidated.emit()
        await live.checkpoint()
        returned = await execute({
          ref: Object.freeze({ taskRunId: id }),
          signal: live.controller.signal,
          checkpoint: live.checkpoint,
          /** Publishes validated progress independently from history writes. */
          reportProgress(progress) {
            live.set(live.current.status, parseTaskProgress(progress))
          },
          /** Saves a validated partial result at the business checkpoint. */
          async reportResult(value) {
            result = parseJsonValue(value)
            try {
              await call('checkpointTask', id, result)
            } catch (cause) {
              checkpointFailure = new DesktopError(
                'WriteFailed',
                'The task checkpoint could not be saved',
                { cause },
              )
              live.controller.abort(checkpointFailure)
              throw checkpointFailure
            }
            invalidated.emit()
          },
        })
        result = parseJsonValue(returned)
        if (checkpointFailure) {
          throw checkpointFailure
        }
      } catch (cause) {
        const failure = checkpointFailure ?? cause
        const cancelled =
          failure instanceof DesktopError
            ? failure.code === 'Cancelled'
            : live.controller.signal.aborted &&
              (failure === live.controller.signal.reason ||
                (failure instanceof Error && failure.name === 'AbortError'))
        status = cancelled ? 'cancelled' : 'failed'
        error =
          failure instanceof DesktopError
            ? { code: failure.code, message: failure.message }
            : {
                code: started ? 'OperationFailed' : 'WriteFailed',
                message: started ? 'The task failed' : 'The task could not be recorded',
              }
        if (failure instanceof DesktopError && Object.hasOwn(failure, 'partialResult')) {
          try {
            result = parseJsonValue(failure.partialResult)
          } catch {
            error = { code: 'InvalidInput', message: 'The task returned an invalid partial result' }
            status = 'failed'
          }
        }
      }
      const terminal: TaskTerminalRun = { ...record, status, result, error, finishedAt: Date.now() }
      try {
        if (started && !checkpointFailure) {
          await call('finishTask', terminal)
        }
      } catch (cause) {
        console.error('Task history commit failed', cause)
        status = 'failed'
        error = { code: 'WriteFailed', message: 'The final task history could not be saved' }
      }
      const outcome = { ...terminal, status, error }
      live.set(status)
      live.ended.resolve(outcome)
      active.delete(id)
      cancel?.[Symbol.dispose]()
      if (started) {
        invalidated.emit()
        const fact: TaskFinished = {
          taskRunId: id,
          type: input.type,
          status,
          result,
          error,
          finishedAt: terminal.finishedAt!,
        }
        finished.emit(fact)
      }
      if (error) {
        throw new DesktopError(
          error.code,
          error.message,
          result === null ? {} : { partialResult: result },
        )
      }
      return returned!
    },
    /** Queries summary rows with the same projected status used for counting. */
    async list(query, options, context) {
      context?.signal?.throwIfAborted()
      return call(
        'listTasks',
        parseTaskQuery(query),
        parseListOptions(options),
        Array.from(active, ([id, live]) => [id, live.current.status] as const),
      )
    },
    /** Reads full saved input, result and error at the requested task identity. */
    async get(ref, context) {
      context?.signal?.throwIfAborted()
      return call('getTask', ref.taskRunId, active.get(ref.taskRunId)?.current.status ?? null)
    },
    /** Attaches to live control state or hands off the retained terminal snapshot. */
    async observe(ref, listener, context) {
      context?.signal?.throwIfAborted()
      const live = active.get(ref.taskRunId)
      if (live) {
        return live.observe(listener)
      }
      listener(state(ref.taskRunId, (await retained(ref.taskRunId)).status))
      return {
        /** Releases an already completed observation. */
        dispose() {},
      }
    },
    /** Waits for live completion or reads the retained terminal record. */
    async wait(ref, context) {
      if (context?.signal?.aborted) {
        throw new DesktopError('Cancelled', 'The wait was cancelled', {
          cause: context.signal.reason,
        })
      }
      return waitFor(
        active.get(ref.taskRunId)?.ended.promise ?? retained(ref.taskRunId),
        context?.signal,
      )
    },
    /** Requests a pause at a safe point. */
    pause(ref, context) {
      return control(ref.taskRunId, 'pause', context)
    },
    /** Withdraws a pending pause or releases the paused execution. */
    resume(ref, context) {
      return control(ref.taskRunId, 'resume', context)
    },
    /** Signals cancellation while retaining completed business work. */
    cancel(ref, context) {
      return control(ref.taskRunId, 'cancel', context)
    },
    /** Deletes only finished history in the requested interval. */
    async clearHistory(filter = {}, context) {
      context?.signal?.throwIfAborted()
      const submitted = parseTaskQuery(filter)
      if (Object.keys(submitted).some((key) => key !== 'types' && key !== 'createdBefore')) {
        throw new DesktopError('InvalidInput', 'Unsupported task history cleanup filter')
      }
      return clearHistory(submitted)
    },
    onInvalidated: invalidated.on,
  }
  return {
    ...api,
    /** Supplies the native task center with the actual choices for its type filter. */
    types: () => call('taskTypes'),
    /** Removes the selected ended record without changing execution or business data. */
    deleteHistory: (ref: TaskRunRef) => clearHistory({}, ref.taskRunId),
    /** Closes or reopens task admission during a cancellable application exit. */
    setAccepting(value: boolean) {
      accepting = value
    },
    /** Includes admitted runs still waiting for their starting history write. */
    get activeCount() {
      return active.size
    },
    /** Waits for the runs already admitted after the application closes admission. */
    async drain() {
      await Promise.all([...active.values()].map((run) => run.ended.promise))
    },
  }
}
