import { DesktopError, type ErrorSummary } from '@kisaki3/desktop-contracts/errors'
import { parseJsonValue, type JsonValue } from '@kisaki3/desktop-contracts/json'
import type {
  TaskExecutionContext,
  TaskRun,
  TaskTerminalRun,
} from '@kisaki3/desktop-contracts/tasks'
import type { DatabaseCall } from '../../infrastructure/database/executor'
import type { createTaskExecution } from './execution'
import type { taskHistory } from './history'

type HistoryCall = DatabaseCall<ReturnType<typeof taskHistory>>

interface FailedTaskOutcome {
  status: 'failed' | 'cancelled'
  error: ErrorSummary
  result: JsonValue | undefined
}

type TaskOutcome<Result> =
  | { status: 'completed'; value: Result; result: JsonValue }
  | FailedTaskOutcome

type TaskAttempt<Result> =
  | { history: 'ready-to-finish'; outcome: TaskOutcome<Result> }
  | { history: 'unrecorded' | 'checkpoint-failed'; outcome: FailedTaskOutcome }

function failedOutcome(
  cause: unknown,
  signal: AbortSignal,
  fallback: ErrorSummary,
  result?: JsonValue,
): FailedTaskOutcome {
  const cancelled =
    cause instanceof DesktopError
      ? cause.code === 'Cancelled'
      : signal.aborted &&
        (cause === signal.reason || (cause instanceof Error && cause.name === 'AbortError'))
  const error =
    cause instanceof DesktopError ? { code: cause.code, message: cause.message } : fallback

  if (cause instanceof DesktopError && Object.hasOwn(cause, 'partialResult')) {
    try {
      result = parseJsonValue(cause.partialResult)
    } catch {
      return {
        status: 'failed',
        error: { code: 'InvalidInput', message: 'The task returned an invalid partial result' },
        result,
      }
    }
  }

  return { status: cancelled ? 'cancelled' : 'failed', error, result }
}

export async function executeTask<Result>(
  call: HistoryCall,
  record: TaskRun,
  execution: ReturnType<typeof createTaskExecution>,
  execute: (context: TaskExecutionContext<Result>) => Promise<Result>,
  invalidate: () => void,
): Promise<TaskAttempt<Result>> {
  const { signal } = execution
  try {
    await call('startTask', record)
  } catch (cause) {
    return {
      history: 'unrecorded',
      outcome: failedOutcome(cause, signal, {
        code: 'WriteFailed',
        message: 'The task could not be recorded',
      }),
    }
  }

  execution.start()
  invalidate()

  let result: JsonValue | undefined
  let checkpointError: DesktopError | undefined

  try {
    await execution.checkpoint()
    const value = await execute({
      ref: Object.freeze({ taskRunId: record.id }),
      signal,
      checkpoint: execution.checkpoint,
      reportProgress: execution.reportProgress,
      async reportResult(value) {
        result = parseJsonValue(value)
        try {
          await call('checkpointTask', record.id, result)
        } catch (cause) {
          checkpointError = new DesktopError(
            'WriteFailed',
            'The task checkpoint could not be saved',
            {
              cause,
            },
          )
          execution.abort(checkpointError)
          throw checkpointError
        }
        invalidate()
      },
    })
    result = parseJsonValue(value)

    // A business callback can handle its own error, but only the runner can settle failed history.
    if (checkpointError) {
      throw checkpointError
    }
    return { history: 'ready-to-finish', outcome: { status: 'completed', value, result } }
  } catch (cause) {
    return {
      history: checkpointError ? 'checkpoint-failed' : 'ready-to-finish',
      outcome: failedOutcome(
        checkpointError ?? cause,
        signal,
        { code: 'OperationFailed', message: 'The task failed' },
        result,
      ),
    }
  }
}

export function terminalRecord(
  started: TaskRun,
  outcome: TaskOutcome<unknown>,
  finishedAt: number,
): TaskTerminalRun {
  return {
    ...started,
    status: outcome.status,
    result: outcome.result ?? null,
    error: outcome.status === 'completed' ? null : outcome.error,
    finishedAt,
  }
}

export async function persistTaskOutcome<Result>(
  call: HistoryCall,
  started: TaskRun,
  attempt: TaskAttempt<Result>,
  finishedAt: number,
): Promise<TaskOutcome<Result>> {
  const { outcome, history } = attempt
  if (history === 'ready-to-finish') {
    try {
      await call('finishTask', terminalRecord(started, outcome, finishedAt))
    } catch (cause) {
      console.error('Task history commit failed', cause)
      return {
        status: 'failed',
        error: { code: 'WriteFailed', message: 'The final task history could not be saved' },
        result: outcome.result,
      }
    }
  }

  return outcome
}
