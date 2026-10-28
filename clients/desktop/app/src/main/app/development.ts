/**
 * @fileoverview Connects the application to its development parent for initialization,
 * readiness and normal shutdown requests.
 */

import { app } from 'electron'
import {
  developmentProtocolVersion,
  parseDevelopmentCommand,
} from '@kisaki3/desktop-contracts/development'
import type {
  DevelopmentEvent,
  DevelopmentStopResult,
} from '@kisaki3/desktop-contracts/development'
import { logFailure } from '../infrastructure/log'

/** Main owns application work; this connection only accepts finite development commands. */
export interface ApplicationDevelopment {
  ready(buildId: string, appVersion: string): Promise<void>
  shutdown(result: DevelopmentStopResult): Promise<void>
}

/** Bind the inherited channel before startup awaits; both source and packaged launches use this path. */
export function connectDevelopment(): ApplicationDevelopment {
  let initialized = false
  let ready = false
  let stopping = false
  let failed = false

  let resolveInitialization!: () => void
  let rejectInitialization!: (cause: Error) => void
  const initialization = new Promise<void>((resolve, reject) => {
    resolveInitialization = resolve
    rejectInitialization = reject
  })
  void initialization.catch(() => undefined)

  /** Wait for Node to hand the event to the channel before completing application shutdown. */
  function send(message: DevelopmentEvent): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!process.connected || !process.send) {
        reject(new Error('Development parent IPC is unavailable'))
        return
      }

      process.send(message, (cause) => (cause ? reject(cause) : resolve()))
    })
  }

  /** Invalid startup or command state ends this connection without interpreting further messages. */
  async function fail(cause: Error): Promise<void> {
    if (failed) return

    failed = true
    clearTimeout(timeout)
    rejectInitialization(cause)
    logFailure('app', cause)

    try {
      await send({
        type: 'failed',
        error: { code: 'development.unavailable', message: cause.message },
      })
    } catch (sendFailure) {
      logFailure('app', sendFailure)
    }

    app.quit()
  }

  const timeout = setTimeout(() => {
    void fail(new Error('Development initialization timed out'))
  }, 10_000)

  process.on('message', (value: unknown) => {
    if (failed) return

    try {
      const message = parseDevelopmentCommand(value)
      if (message.type === 'initialize') {
        if (initialized || message.protocolVersion !== developmentProtocolVersion) {
          throw new Error('Unsupported or repeated development initialization')
        }

        initialized = true
        clearTimeout(timeout)
        resolveInitialization()
        return
      }

      if (!initialized || !ready) throw new Error('Development command arrived before readiness')
      if (message.type === 'buildsReady') {
        throw new Error('Extension loading is unavailable in this application')
      }

      if (!stopping) {
        stopping = true
        app.quit()
      }
    } catch (cause) {
      void fail(cause instanceof Error ? cause : new Error('Invalid development command'))
    }
  })

  process.once('disconnect', () => {
    clearTimeout(timeout)
    rejectInitialization(new Error('Development parent IPC disconnected'))

    if (!stopping) {
      logFailure('app', new Error('Development parent IPC disconnected'))
      app.quit()
    }
  })

  return {
    async ready(buildId, appVersion) {
      await initialization
      if (failed) throw new Error('Development connection failed during startup')

      ready = true
      await send({
        type: 'ready',
        protocolVersion: developmentProtocolVersion,
        appVersion,
        apiVersion: null,
        buildId,
      })
    },
    async shutdown(result) {
      if (!process.connected || (!stopping && result.outcome !== 'exiting')) return

      stopping = result.outcome === 'exiting'
      await send(result)
    },
  }
}
