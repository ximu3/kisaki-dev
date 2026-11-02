/**
 * @fileoverview Runs a real development session in a test-owned child and reports its
 * state to the parent test.
 */

import { fileURLToPath } from 'node:url'
import { isCancellation } from '@kisaki3/tooling/errors'
import { launchFixtureApplication } from './fixture-application'
import { startDevelopmentSession } from '../../tools/dev/session'
import type { DevelopmentSession } from '../../tools/dev/session'

const controller = new AbortController()
let rejectStop!: (cause: unknown) => void
const stopFailure = new Promise<never>((_resolve, reject) => {
  rejectStop = reject
})
let session: DevelopmentSession | undefined
let failed = false

const stop = () => {
  if (session) {
    void session.stop().then((result) => {
      if (result === 'cancelled' && process.connected) {
        process.send?.({
          state: 'cancelled',
          current: session?.current,
          rendererUrl: session?.rendererUrl,
        })
      }
    }, rejectStop)
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
    sourceRoot: fileURLToPath(new URL('../fixtures/runtime', import.meta.url)),
    launch: launchFixtureApplication,
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

  // A failed stop leaves the session owned, so closed alone cannot report that failure.
  await Promise.race([session.closed, stopFailure])
} catch (cause) {
  if (!isCancellation(cause, controller.signal)) {
    failed = true
    console.error(cause)
    process.exitCode = 1
  }
} finally {
  try {
    if (failed) {
      await session?.terminate()
    } else {
      await session?.stop()
    }
  } catch (cause) {
    console.error(cause)
    process.exitCode = 1
  }

  process.off('message', message)
  process.off('disconnect', stop)
  if (process.connected) {
    process.disconnect()
  }
}
