import { CommandFailed } from './process/index.ts'
import { isCancellation } from './errors.ts'

/**
 * Sets the exit status after the action settles. Cancellation uses the first signal's shell status.
 * An independent failure during cancellation reports its own error or child status.
 */
export async function runCli(action: (signal: AbortSignal) => Promise<void>): Promise<void> {
  const controller = new AbortController()
  let cancelledCode = 130

  function cancel(exitCode: 130 | 143, message: string) {
    if (!controller.signal.aborted) {
      cancelledCode = exitCode
      controller.abort(new Error(message))
    }
  }

  const interrupt = () => cancel(130, 'Operation interrupted')
  const terminate = () => cancel(143, 'Operation terminated')
  process.once('SIGINT', interrupt)
  process.once('SIGTERM', terminate)

  try {
    await action(controller.signal)

    if (controller.signal.aborted) {
      process.exitCode = cancelledCode
    }
  } catch (cause) {
    if (isCancellation(cause, controller.signal)) {
      process.exitCode = cancelledCode
    } else if (cause instanceof CommandFailed) {
      process.exitCode = cause.exitCode
    } else {
      console.error(cause)
      process.exitCode = 1
    }
  } finally {
    process.off('SIGINT', interrupt)
    process.off('SIGTERM', terminate)
  }
}
