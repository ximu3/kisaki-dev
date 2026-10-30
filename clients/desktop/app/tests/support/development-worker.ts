/**
 * @fileoverview Runs a real development session in a test-owned child and reports its
 * state to the parent test.
 */

import { startDevelopmentSession } from '../../tools/dev/session'
import type { DevelopmentSession } from '../../tools/dev/session'

const controller = new AbortController()
let session: DevelopmentSession | undefined
let failure: unknown

const stop = () => {
  if (session) {
    void session.stop().then(
      (result) => {
        if (result === 'cancelled' && process.connected) {
          process.send?.({
            state: 'cancelled',
            current: session?.current,
            rendererUrl: session?.rendererUrl,
          })
        }
      },
      (cause: unknown) => {
        failure = cause
      },
    )
  } else {
    controller.abort(new Error('Fixture development session stopped'))
  }
}

const message = (value: unknown) => {
  if (value && typeof value === 'object' && 'type' in value && value.type === 'stop') {
    stop()
  }
}

process.on('message', message)
process.once('disconnect', stop)

try {
  session = await startDevelopmentSession({
    signal: controller.signal,
    onState(state, error) {
      if (process.connected) {
        process.send?.(
          {
            state,
            current: session?.current,
            rendererUrl: session?.rendererUrl,
            error: error instanceof Error ? error.message : undefined,
          },
          (cause) => {
            if (cause) {
              controller.abort(cause)
            }
          },
        )
      }
    },
  })

  await session.closed
} catch (cause) {
  if (!controller.signal.aborted || cause instanceof AggregateError) {
    failure = cause
  }
} finally {
  try {
    await session?.stop()
  } catch (cause) {
    failure ??= cause
  }

  process.off('message', message)
  process.off('disconnect', stop)
  if (process.connected) {
    process.disconnect()
  }
}

if (failure) {
  console.error(failure)
  process.exitCode = 1
}
