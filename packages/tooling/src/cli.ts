/**
 * @fileoverview Owns command-line cancellation handlers and maps completed engineering
 * operations to process exit status.
 */

import { CommandFailed } from './process'
import { isCancellation } from './errors'

/**
 * Waits for a CLI action and maps its outcome to process.exitCode.
 *
 * Installs cancellation handlers before starting the action and removes them after it settles.
 * Child-command failures replay captured diagnostics; signal cancellation uses the corresponding
 * shell exit status.
 */
export async function runCli(action: (signal: AbortSignal) => Promise<void>): Promise<void> {
  const controller = new AbortController()
  let cancelledCode = 130

  /** Requests cancellation when the CLI receives SIGINT. */
  const interrupt = () => controller.abort(new Error('Operation interrupted'))
  /** Records the SIGTERM exit status and requests cancellation. */
  const terminate = () => {
    cancelledCode = 143
    controller.abort(new Error('Operation terminated'))
  }

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
      if (cause.stdout) {
        process.stdout.write(cause.stdout)
      }
      if (cause.stderr) {
        process.stderr.write(cause.stderr)
      }
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
