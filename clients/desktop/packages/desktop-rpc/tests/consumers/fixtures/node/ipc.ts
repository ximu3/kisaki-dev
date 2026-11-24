import type { ChildProcess } from 'node:child_process'
import type { RpcTransport } from '@kisaki3/desktop-rpc'

export function ipcTransport(channel: ChildProcess | NodeJS.Process): RpcTransport {
  let failed: (cause: Error) => void
  let detach: () => void

  return {
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

    send(frame) {
      channel.send!(frame, undefined, undefined, (error: Error | null) => {
        if (error) {
          failed(error)
        }
      })
    },

    close() {
      detach()
      if (channel.connected) {
        channel.disconnect()
      }
    },
  }
}
