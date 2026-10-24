/** Declaration consumption only; provider ownership and cancellation still need a real addon. */
import type { Mpv, MpvClient } from '../libmpv-control/contract.js'
import type { MpvStreamProvider, MpvStreamSource } from './contract.js'

declare const mpv: Mpv
declare const client: MpvClient
declare const output: 'javascript' | 'native'
declare const consume: (value: unknown) => void

const source: MpvStreamSource = {
  read: () => null,
  seek(offset) {
    const position: bigint = offset
    consume(position)
  },
  getSize: () => 0n,
  async close() {
    consume('cleanup')
  }
}
const provider: MpvStreamProvider = {
  async open(request) {
    const uri: string = request.uri
    consume([uri, request.signal])
    return source
  },
  onError(failure) {
    const reason: unknown = failure.reason
    if (failure.operation !== 'open') {
      const uri: string = failure.request.uri
      consume(uri)
    }
    consume(reason)
  }
}

async function checkStreams() {
  const registration: void = await mpv.registerProtocol('example', provider)
  consume(registration)
  // @ts-expect-error A protocol is not an independently disposable subscription.
  registration.dispose()
  // @ts-expect-error Protocol registrations belong to the owning core.
  await client.registerProtocol('example', provider)
  // @ts-expect-error Registration does not accept cancellation of its wait.
  await mpv.registerProtocol('example', provider, { signal: new AbortController().signal })
  // @ts-expect-error The URI representation must match the provider's input.
  await mpv.registerProtocol('example', provider, { output: 'native' })
  // @ts-expect-error A per-operation failure receiver is required.
  await mpv.registerProtocol('example', { open: () => source })
  const nativeProvider: MpvStreamProvider<Uint8Array<ArrayBuffer>> = {
    open(request) {
      const uri: Uint8Array<ArrayBuffer> = request.uri
      consume(uri)
      return source
    },
    onError: consume
  }
  await mpv.registerProtocol('bytes', nativeProvider, { output: 'native' })
  // @ts-expect-error A byte URI provider cannot silently select native output.
  await mpv.registerProtocol('bytes', nativeProvider)
  const dynamicProvider: MpvStreamProvider<string | Uint8Array<ArrayBuffer>> = {
    open(request) {
      consume(request.uri)
      return source
    },
    onError: consume
  }
  await mpv.registerProtocol('dynamic', dynamicProvider, { output })
  // @ts-expect-error A string-only provider cannot consume a dynamic representation.
  await mpv.registerProtocol('dynamic', provider, { output })
}

// @ts-expect-error An opened source must provide resource cleanup.
const missingClose: MpvStreamSource = { read: () => null }
consume(missingClose)
const textRead = () => 'not bytes'
// @ts-expect-error Reads deliver bytes, not strings or ordinary mpv values.
const wrongRead: MpvStreamSource['read'] = textRead
consume(wrongRead)
// @ts-expect-error Positions use bigint throughout the provider contract.
const wrongSeek: MpvStreamSource['seek'] = (offset: number) => consume(offset)
consume(wrongSeek)
// @ts-expect-error Known sizes are signed-64-bit-domain bigint values.
const wrongSize: MpvStreamSource['getSize'] = () => 12
consume(wrongSize)
// @ts-expect-error Cleanup does not accept a signal that can cancel cleanup itself.
const wrongClose: MpvStreamSource['close'] = (signal: AbortSignal) => consume(signal)
consume(wrongClose)

void checkStreams
