/** @fileoverview Binds the fixture's RPC transport to its actual JSON parent/child channel. */

import type { ChildProcess } from 'node:child_process'
import type { RpcTransport } from '@kisaki3/desktop-rpc'

/**
 * Creates an RPC transport for one parent/child JSON IPC channel.
 *
 * Send failures and disconnects are reported through the channel's own lifetime callbacks.
 */
export function ipcTransport(channel: ChildProcess | NodeJS.Process): RpcTransport {
  /** Reports send failures to the close callback captured by start. */
  let failed: (cause: Error) => void
  /** Removes the message, disconnect and error listeners installed for this transport. */
  let detach: () => void

  return {
    /** Attaches receive and loss listeners to this channel. */
    start(receive, closed) {
      failed = closed
      channel.on('message', receive)
      channel.on('disconnect', closed)
      channel.on('error', closed)
      detach = () => {
        channel.off('message', receive)
        channel.off('disconnect', closed)
        channel.off('error', closed)
      }
    },

    /** Sends a frame over JSON IPC and reports asynchronous handoff errors. */
    send(frame) {
      channel.send!(frame, undefined, undefined, (error: Error | null) => {
        if (error) {
          failed(error)
        }
      })
    },

    /** Detaches transport listeners and disconnects the channel if it remains connected. */
    close() {
      detach()
      if (channel.connected) {
        channel.disconnect()
      }
    },
  }
}
