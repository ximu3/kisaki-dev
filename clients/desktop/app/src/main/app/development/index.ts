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
      start(receive, closed) {
        process.on('message', receive)
        process.once('disconnect', closed)
      },
      send(frame) {
        process.send!(frame)
      },
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
        accept: () => identity,
      },
      methods: {
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
