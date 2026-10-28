/**
 * @fileoverview Runs the shared extension-host utility process and handles its readiness
 * and shutdown channel.
 */

import { parentPort } from 'node:worker_threads'
import type { HostControl, HostStatus } from '../shared/extension-host'

/** The parent channel used for extension-host readiness and shutdown. */
interface HostPort {
  on(event: 'message', listener: (event: { data: HostControl }) => void): void
  postMessage(message: HostStatus): void
}

// Electron utility processes expose their parent channel as process.parentPort.
const port: HostPort | undefined = Reflect.get(process, 'parentPort')
if (!port || parentPort) throw new Error('The extension host requires its owning utility process')
port.on('message', ({ data }) => {
  if (data.type === 'stop') process.exit(0)
})
port.postMessage({ type: 'ready' })
