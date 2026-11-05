/** @fileoverview Executes RPC calls on a fork's IPC channel and releases the last listener on disconnect. */

import { RpcConnection, RpcError } from '@kisaki3/desktop-rpc'
import { ipcTransport } from './ipc.js'

const rpc: RpcConnection = new RpcConnection(ipcTransport(process), {
  protocol: { id: 'fixture.child', version: 1 },
  handshake: { role: 'acceptor', accept: () => 'child' },
  methods: {
    roundTrip: (args) => rpc.request('echo', args),
    restricted() {
      throw new RpcError('PermissionDenied', 'Read access required')
    },
    async work(_args, signal) {
      rpc.notify('started', null)
      await new Promise<void>((resolve) =>
        signal.addEventListener('abort', () => resolve(), { once: true }),
      )
      return { committed: 1 }
    },
    async detach() {
      process.disconnect()
      await rpc.closed
    },
  },
})

await rpc.ready
await rpc.closed
