/** @fileoverview Executes RPC calls on a fork's IPC channel and releases the last listener on disconnect. */

import { RpcConnection, RpcError } from '@kisaki3/desktop-rpc'
import { ipcTransport } from './ipc.js'

/**
 * Child-side connection exercising reverse calls, safe failures and cancellation over real process
 * IPC.
 */
const rpc: RpcConnection = new RpcConnection(ipcTransport(process), {
  protocol: { id: 'fixture.child', version: 1 },
  handshake: {
    role: 'acceptor',
    /** Accepts the parent fixture with a synthetic child-process handshake context. */
    accept: () => 'child',
  },
  methods: {
    /** Calls the parent echo method and returns the completed reverse-call result. */
    roundTrip: (args) => rpc.request('echo', args),
    /** Rejects the synthetic protected operation with its explicit permission failure. */
    restricted() {
      throw new RpcError('PermissionDenied', 'Read access required')
    },
    /** Waits for cancellation before returning the fixture's already committed outcome. */
    async work(_args, signal) {
      rpc.notify('started', null)
      await new Promise<void>((resolve) =>
        signal.addEventListener('abort', () => resolve(), { once: true }),
      )
      return { committed: 1 }
    },
    /** Disconnects the real IPC transport and waits for the connection to close. */
    async detach() {
      process.disconnect()
      await rpc.closed
    },
  },
})

await rpc.ready
await rpc.closed
