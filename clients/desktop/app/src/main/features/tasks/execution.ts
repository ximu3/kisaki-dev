import {
  isTaskTerminal,
  parseTaskProgress,
  type TaskRunStatus,
  type TaskState,
  type TaskTerminalRun,
} from '@kisaki3/desktop-contracts/tasks'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { Listener } from '@kisaki3/desktop-contracts/operations'
import { createSignal } from '../../infrastructure/events'

export function taskState(
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

export function createTaskExecution(id: string, supportsPause: boolean, invalidate: () => void) {
  const changed = createSignal<TaskState>()
  const controller = new AbortController()
  const terminal = Promise.withResolvers<TaskTerminalRun>()
  let current = taskState(id, 'queued', supportsPause)
  let gate: PromiseWithResolvers<void> | undefined

  function publishState(status: TaskRunStatus, progress = current.progress) {
    current = taskState(id, status, supportsPause, progress)
    changed.emit(current)
    if (isTaskTerminal(status)) {
      changed.clear()
    }
  }

  // Control transitions change membership in status-filtered queries.
  function transition(status: TaskRunStatus) {
    if (status !== current.status) {
      publishState(status)
      invalidate()
    }
  }

  return {
    settled: terminal.promise,
    signal: controller.signal,
    get state() {
      return current
    },

    start() {
      if (current.status === 'queued') {
        publishState('running')
      }
    },
    finish(run: TaskTerminalRun) {
      publishState(run.status)
      terminal.resolve(run)
    },
    abort(cause: DesktopError) {
      controller.abort(cause)
    },
    reportProgress(this: void, progress: NonNullable<TaskState['progress']>) {
      publishState(current.status, parseTaskProgress(progress))
    },

    observe(listener: Listener<TaskState>) {
      return changed.observe(listener, current)
    },

    pause() {
      if (current.canPause) {
        gate = Promise.withResolvers()
        transition('pausing')
      }
      return current
    },

    resume() {
      if (gate) {
        gate.resolve()
        gate = undefined
        transition('running')
      }
      return current
    },

    cancel() {
      if (current.canCancel) {
        transition('cancelling')
        controller.abort(new DesktopError('Cancelled', 'The task was cancelled'))
        gate?.resolve()
        gate = undefined
      }
      return current
    },

    async checkpoint(this: void) {
      controller.signal.throwIfAborted()

      while (gate) {
        transition('paused')
        await gate.promise
        controller.signal.throwIfAborted()
      }
    },
  }
}
