/**
 * @fileoverview Runs a real development session in a test-owned child and reports its
 * state to the parent test.
 */

import { fileURLToPath } from 'node:url'
import { isCancellation } from '@kisaki3/tooling/errors'
import { launchFixtureApplication } from '../fixture-application'
import { startDevelopmentSession } from '../../../tools/dev/session'
import type { DevelopmentSession } from '../../../tools/dev/session'

/** Cancellation owner for initial development preparation. */
const controller = new AbortController()

/** Fault or lifecycle scenario selected by the parent test. */
const scenario = process.argv[2]

/** Rejects the deliberately injected application-stop failure when requested by the parent. */
let rejectStop!: (cause: unknown) => void

/** Pending failure used to exercise a stop rejection while process ownership remains explicit. */
const stopFailure = new Promise<never>((_resolve, reject) => {
  rejectStop = reject
})

/** Development session owned and closed by this child process. */
let session: DevelopmentSession | undefined

/** Records whether the worker must report an unsuccessful terminal outcome. */
let failed = false

/**
 * Requests normal session shutdown, or cancels startup before a session handle exists.
 *
 * Reports a declined close to the parent and forwards stop failures to the worker's failure
 * promise.
 */
function stop(): void {
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

/**
 * Stops an existing test session, allowing its deliberate first-close refusal once.
 *
 * Before a session exists, requests startup cancellation. A second close refusal rejects cleanup.
 */
async function cleanup(): Promise<void> {
  const current = session
  if (!current) {
    controller.abort(new Error('Fixture development session stopped'))
    return
  }

  const outcome = await current.stop()
  if (outcome === 'cancelled') {
    const final = await current.stop()
    if (final === 'cancelled') {
      throw new Error('Fixture refused test-scope cleanup')
    }
  }
}

/** Dispatches recognized stop and cleanup commands from the parent test. */
const message = (value: unknown) => {
  if (!value || typeof value !== 'object' || !('type' in value)) {
    return
  }

  if (value.type === 'stop') {
    stop()
  } else if (value.type === 'cleanup') {
    void cleanup().catch(rejectStop)
  }
}

/** Requests test-session cleanup when the parent IPC channel disconnects. */
const disconnected = () => {
  void cleanup().catch(rejectStop)
}

process.on('message', message)
process.once('disconnect', disconnected)

try {
  session = await startDevelopmentSession({
    sourceRoot: fileURLToPath(new URL('../../fixtures/runtime', import.meta.url)),
    /** Launches the real carrier and wraps only the lifecycle fault selected by the parent test. */
    async launch(options) {
      const application = await launchFixtureApplication({
        ...options,
        args:
          scenario === 'cancel-first-close'
            ? [...options.args, '--cancel-first-close']
            : options.args,
      })
      if (scenario !== 'stop-failure') {
        return application
      }

      // Fail the first stop at the supplied application boundary; termination keeps its real owner.
      let rejectStop = true
      return {
        ...application,
        /**
         * Injects one normal-stop failure, then delegates subsequent calls to the real application.
         */
        stop() {
          if (rejectStop) {
            rejectStop = false
            return Promise.reject(new Error('Synthetic application stop failure'))
          }

          return application.stop()
        },
      }
    },
    signal: controller.signal,
    /**
     * Forwards session state and diagnostic messages to the parent while its IPC channel is
     * connected.
     */
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
  process.off('disconnect', disconnected)
  if (process.connected) {
    process.disconnect()
  }
}
