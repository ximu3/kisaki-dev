import { randomUUID } from 'node:crypto'
import { addAbortListener } from 'node:events'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { parseListOptions, type CallOptions } from '@kisaki3/desktop-contracts/operations'
import {
  parseTaskDefinition,
  parseTaskQuery,
  type TaskRun,
  type TaskHistoryFilter,
  type TaskRunRef,
  type TasksApi,
  type TaskTerminalRun,
} from '@kisaki3/desktop-contracts/tasks'
import type { TaskFinished, NativeEventPublisher } from '@kisaki3/desktop-contracts/events'
import type { DatabaseCall } from '../../infrastructure/database/executor'
import { waitFor } from '../../infrastructure/wait'
import { createSignal } from '../../infrastructure/events'
import type { taskHistory } from './history'
import { createTaskExecution, taskState } from './execution'
import { executeTask, persistTaskOutcome, terminalRecord } from './runner'

type TaskService = Omit<TasksApi, 'list'> & {
  list(query: unknown, options: unknown, context?: CallOptions): ReturnType<TasksApi['list']>
}

export async function createTasks(
  call: DatabaseCall<ReturnType<typeof taskHistory>>,
  finished: NativeEventPublisher<'tasks.finished'>,
) {
  const active = new Map<string, ReturnType<typeof createTaskExecution>>()
  const invalidated = createSignal<void>()
  let accepting = true

  await call('interruptTasks')

  async function readEndedTask(id: string): Promise<TaskTerminalRun> {
    const row = await call('getEndedTask', id)
    if (!row) {
      throw new DesktopError('NotFound', 'The task history does not exist')
    }
    return row
  }

  async function control(id: string, action: 'pause' | 'resume' | 'cancel', options?: CallOptions) {
    options?.signal?.throwIfAborted()
    const live = active.get(id)
    return live ? live[action]() : taskState(id, (await readEndedTask(id)).status)
  }

  async function clearHistory(filter: TaskHistoryFilter, id?: string) {
    const removed = await call('clearTasks', filter, [...active.keys()], id)
    if (removed) {
      invalidated.emit()
    }
    return removed
  }

  const api: TaskService = {
    async run(definition, execute, options) {
      options?.signal?.throwIfAborted()
      if (!accepting) {
        throw new DesktopError('Busy', 'The application is closing')
      }

      const input = parseTaskDefinition(definition)
      const id = randomUUID()
      const live = createTaskExecution(id, input.supportsPause ?? false, invalidated.emit)
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

      const cancellation = options?.signal && addAbortListener(options.signal, () => live.cancel())
      active.set(id, live)

      const attempt = await executeTask(call, record, live, execute, invalidated.emit)
      const finishedAt = Date.now()
      const outcome = await persistTaskOutcome(call, record, attempt, finishedAt)
      const terminal = terminalRecord(record, outcome, finishedAt)

      live.finish(terminal)
      active.delete(id)
      cancellation?.[Symbol.dispose]()

      if (attempt.history !== 'unrecorded') {
        invalidated.emit()
        const fact: TaskFinished = {
          taskRunId: id,
          type: record.type,
          status: terminal.status,
          result: terminal.result,
          error: terminal.error,
          finishedAt,
        }
        finished.emit(fact)
      }

      if (outcome.status === 'completed') {
        return outcome.value
      }
      throw new DesktopError(
        outcome.error.code,
        outcome.error.message,
        outcome.result === undefined ? {} : { partialResult: outcome.result },
      )
    },

    async list(query: unknown, options: unknown, context?: CallOptions) {
      context?.signal?.throwIfAborted()
      return call(
        'listTasks',
        parseTaskQuery(query),
        parseListOptions(options),
        Array.from(active, ([id, live]) => [id, live.state.status] as const),
      )
    },

    async get(ref, context) {
      context?.signal?.throwIfAborted()
      return call('getTask', ref.taskRunId, active.get(ref.taskRunId)?.state.status ?? null)
    },

    async observe(ref, listener, context) {
      context?.signal?.throwIfAborted()
      const live = active.get(ref.taskRunId)
      if (live) {
        return live.observe(listener)
      }

      listener(taskState(ref.taskRunId, (await readEndedTask(ref.taskRunId)).status))
      return {
        dispose() {},
      }
    },

    async wait(ref, context) {
      if (context?.signal?.aborted) {
        throw new DesktopError('Cancelled', 'The wait was cancelled', {
          cause: context.signal.reason,
        })
      }
      return waitFor(
        active.get(ref.taskRunId)?.settled ?? readEndedTask(ref.taskRunId),
        context?.signal,
      )
    },

    pause(ref, context) {
      return control(ref.taskRunId, 'pause', context)
    },
    resume(ref, context) {
      return control(ref.taskRunId, 'resume', context)
    },
    cancel(ref, context) {
      return control(ref.taskRunId, 'cancel', context)
    },

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
    types: () => call('taskTypes'),
    async deleteHistory(ref: TaskRunRef, options?: CallOptions) {
      options?.signal?.throwIfAborted()
      return clearHistory({}, ref.taskRunId)
    },
    setAccepting(value: boolean) {
      accepting = value
    },
    get activeCount() {
      return active.size
    },
    async drain() {
      await Promise.all([...active.values()].map((run) => run.settled))
    },
  }
}
