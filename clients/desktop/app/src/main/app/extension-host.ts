/**
 * @fileoverview Owns the shared extension-host utility process from its readiness
 * handshake through shutdown.
 */

import { utilityProcess } from 'electron'
import { join } from 'node:path'
import { logFailure, logLifecycle } from '../infrastructure/log'
import type { HostControl, HostStatus } from '../../shared/extension-host'

/** A ready shared host; its owner must wait for stop before releasing the runtime directory. */
export interface ExtensionHostProcess {
  stop(): Promise<void>
}

/** Start the host through Electron's utility API, which also works with RunAsNode disabled. */
export async function startExtensionHost(runtime: string): Promise<ExtensionHostProcess> {
  const child = utilityProcess.fork(join(runtime, 'extension-host', 'entry.js'), [], {
    serviceName: 'Kisaki Extension Host',
    stdio: 'pipe',
  })

  let exited = false
  const completion = new Promise<void>((resolve) => {
    child.once('exit', () => {
      exited = true
      resolve()
    })
  })

  try {
    await new Promise<void>((resolve, reject) => {
      // Allow 10 seconds for the utility process to attach its lifecycle handlers.
      const timeout = setTimeout(
        () => reject(new Error('Extension host did not become ready')),
        10_000,
      )
      const onExit = () => {
        clearTimeout(timeout)
        reject(new Error('Extension host exited before readiness'))
      }

      child.once('exit', onExit)
      child.once('message', (message: HostStatus) => {
        clearTimeout(timeout)
        child.off('exit', onExit)

        if (message.type !== 'ready') reject(new Error('Invalid extension host readiness message'))
        else resolve()
      })
    })
  } catch (cause) {
    child.kill()
    await completion

    throw cause
  }

  logLifecycle('extensions', 'Host ready')

  let stopping: Promise<void> | undefined
  return {
    stop() {
      stopping ??= (async () => {
        if (exited) return

        const stop: HostControl = { type: 'stop' }
        child.postMessage(stop)

        // Give the host five seconds to handle stop before terminating the process.
        const timeout = setTimeout(() => {
          logFailure('extensions', new Error('Host stop timed out'))
          child.kill()
        }, 5_000)

        await completion
        clearTimeout(timeout)
        logLifecycle('extensions', 'Host stopped')
      })()

      return stopping
    },
  }
}
