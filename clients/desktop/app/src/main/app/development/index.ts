/** @fileoverview Connects an unpackaged app to its actual source launcher and handles a normal stop. */

import { RpcConnection } from '@kisaki3/desktop-rpc'
import {
  developmentProtocolId,
  developmentProtocolVersion,
} from '@kisaki3/desktop-contracts/development'
import manifest from '../../../../package.json' with { type: 'json' }

/** Announces the current build and waits for the same quit decision as native app commands. */
export function developmentControl(stop: () => Promise<boolean>) {
  const identity = { buildId: __KISAKI_BUILD_ID__, appVersion: manifest.version }
  const rpc = new RpcConnection(
    {
      /** Attaches the transport to this launcher's process channel. */
      start(receive, closed) {
        process.on('message', receive)
        process.once('disconnect', closed)
      },
      /** Hands one frame to the bound parent process. */
      send(frame) {
        process.send!(frame)
      },
      /** Releases the source launcher's channel on disconnect. */
      close() {
        if (process.connected) {
          process.disconnect()
        }
      },
    },
    {
      protocol: { id: developmentProtocolId, version: developmentProtocolVersion },
      handshake: {
        role: 'acceptor',
        /** Returns the application version and build identity for this launch. */
        accept: () => identity,
      },
      methods: {
        /** Returns the actual disposition of the shared normal exit request. */
        async stop() {
          return { outcome: (await stop()) ? 'exiting' : 'cancelled' }
        },
      },
    },
  )
  void rpc.ready.catch(console.error)
  return async () => {
    await rpc.ready
    rpc.notify('ready', { ...identity, apiVersion: null })
  }
}
