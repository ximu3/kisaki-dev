/**
 * @fileoverview Owns command-line cancellation handlers and maps completed engineering
 * operations to process exit status.
 */

import { CommandFailed } from './process'

/** Install cancellation before preparation, and report failure only after the action has closed. */
export async function runCli(action: (signal: AbortSignal) => Promise<void>): Promise<void> {
  const controller = new AbortController()
  let cancelledCode = 130

  const interrupt = () => controller.abort(new Error('Operation interrupted'))
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
    if (controller.signal.aborted) {
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
