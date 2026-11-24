import { connectionClosed, RpcError, safeFailure } from '../errors'
import { hasUnknownWireVersion, parseRpcFrame, rpcWireVersion, type RpcFrame } from '../frames'
import { parseJsonValue, type JsonValue } from '../json'
import type { RpcTransport } from '../transport'
import { defaultErrorCodec, type RpcEndpoint, type RpcErrorCodec, type RpcMethod } from './endpoint'
import { OutgoingCalls } from './outgoing'

interface ActiveConnection {
  readonly transport: RpcTransport
  readonly endpoint: RpcEndpoint
  established: boolean
}

export class RpcConnection {
  #resolveReady!: (context: JsonValue) => void
  #rejectReady!: (error: RpcError) => void
  readonly ready = new Promise<JsonValue>((resolve, reject) => {
    this.#resolveReady = resolve
    this.#rejectReady = reject
  })

  #resolveClosed!: (reason: RpcError) => void
  readonly closed = new Promise<RpcError>((resolve) => {
    this.#resolveClosed = resolve
  })

  #active: ActiveConnection | undefined
  readonly #timer: ReturnType<typeof setTimeout>

  readonly #outgoing = new OutgoingCalls()
  readonly #incoming = new Map<number, AbortController>()
  #lastIncomingId = 0

  constructor(transport: RpcTransport, endpoint: RpcEndpoint) {
    this.#active = { transport, endpoint, established: false }
    this.#timer = setTimeout(
      () => this.#end(new RpcError('ConnectionClosed', 'RPC handshake timed out')),
      10_000,
    )

    try {
      transport.start(
        (input) => this.#receive(input),
        (cause) => this.#end(connectionClosed(cause)),
      )
      if (endpoint.handshake.role === 'initiator' && this.#active) {
        this.#send(
          parseRpcFrame({
            type: 'hello',
            wireVersion: rpcWireVersion,
            protocol: endpoint.protocol,
            context: endpoint.handshake.context,
          }),
        )
      }
    } catch (cause) {
      this.#end(cause instanceof RpcError ? cause : connectionClosed(cause))
    }
  }

  async request(
    method: string,
    args: readonly JsonValue[] = [],
    options?: { readonly signal?: AbortSignal },
  ): Promise<JsonValue | void> {
    this.#requireReady()
    if (this.#exhausted) {
      throw new RpcError('ResourceLimit', 'RPC request IDs are exhausted')
    }

    const values = parseJsonValue(args)
    if (typeof method !== 'string' || !Array.isArray(values)) {
      throw new RpcError('InvalidInput', 'Expected a method name and an argument array')
    }

    return this.#outgoing.request(method, values, options?.signal, (frame) => this.#send(frame))
  }

  notify(topic: string, value: JsonValue): void {
    this.#requireReady()
    if (typeof topic !== 'string') {
      throw new RpcError('InvalidInput', 'Expected a notification topic')
    }
    if (!this.#send({ type: 'notify', topic, value: parseJsonValue(value) })) {
      throw connectionClosed()
    }
  }

  close(): void {
    this.#end(connectionClosed())
  }

  #requireReady(): void {
    const connection = this.#active
    if (!connection) {
      throw connectionClosed()
    }
    if (!connection.established) {
      throw new RpcError('ProtocolViolation', 'RPC handshake is incomplete')
    }
  }

  #send(frame: RpcFrame): boolean {
    const connection = this.#active
    if (!connection) {
      return false
    }

    try {
      connection.transport.send(frame)
      return true
    } catch (cause) {
      this.#end(connectionClosed(cause))
      return false
    }
  }

  #receive(input: unknown): void {
    const connection = this.#active
    if (!connection) {
      return
    }
    const { endpoint } = connection

    try {
      if (
        !connection.established &&
        endpoint.handshake.role === 'acceptor' &&
        hasUnknownWireVersion(input)
      ) {
        this.#rejectHandshake(new RpcError('ProtocolMismatch', 'Unsupported RPC wire version'))
        return
      }

      const frame = parseRpcFrame(input)
      if (!connection.established) {
        this.#handshake(frame, connection)
        return
      }

      switch (frame.type) {
        case 'request':
          this.#receiveRequest(frame, endpoint)
          break
        case 'success':
        case 'failure':
          this.#outgoing.settle(frame, endpoint.errors ?? defaultErrorCodec)
          this.#closeIfDrained()
          break
        case 'cancel':
          if (frame.id > this.#lastIncomingId) {
            throw new RpcError('ProtocolViolation', 'Cancel for an unallocated request')
          }
          this.#incoming.get(frame.id)?.abort(new RpcError('Cancelled', 'Cancellation requested'))
          break
        case 'notify':
          this.#receiveNotification(frame, endpoint.notifications)
          break
        case 'hello':
        case 'accepted':
        case 'rejected':
          throw new RpcError('ProtocolViolation', 'Unexpected handshake frame')
      }
    } catch (cause) {
      this.#end(
        cause instanceof RpcError
          ? cause
          : new RpcError('ProtocolViolation', 'Invalid RPC message', { cause }),
      )
    }
  }

  #handshake(frame: RpcFrame, connection: ActiveConnection): void {
    const { handshake, protocol } = connection.endpoint
    if (handshake.role === 'initiator' && frame.type === 'rejected') {
      this.#end(new RpcError(frame.error.code, frame.error.message))
      return
    }

    let reply: Extract<RpcFrame, { type: 'accepted' }> | undefined
    if (handshake.role === 'initiator' && frame.type === 'accepted') {
      if (handshake.accepts && handshake.accepts(frame.context) !== true) {
        throw new RpcError('ProtocolMismatch', 'Unexpected accepted context')
      }
    } else if (handshake.role === 'acceptor' && frame.type === 'hello') {
      if (protocol.id !== frame.protocol.id || protocol.version !== frame.protocol.version) {
        this.#rejectHandshake(new RpcError('ProtocolMismatch', 'Unsupported endpoint protocol'))
        return
      }

      try {
        reply = { type: 'accepted', context: parseJsonValue(handshake.accept(frame.context)) }
      } catch (cause) {
        this.#rejectHandshake(cause)
        return
      }
    } else {
      throw new RpcError('ProtocolViolation', 'Unexpected frame during RPC handshake')
    }

    if (this.#active !== connection) {
      return
    }
    clearTimeout(this.#timer)
    // The peer can send its first request reentrantly when it receives acceptance.
    connection.established = true
    if (!reply || this.#send(reply)) {
      this.#resolveReady(frame.context)
    }
  }

  #rejectHandshake(cause: unknown): void {
    const error = safeFailure(cause)
    this.#end(new RpcError(error.code, error.message, { cause }), { type: 'rejected', error })
  }

  #receiveRequest(frame: Extract<RpcFrame, { type: 'request' }>, endpoint: RpcEndpoint): void {
    if (frame.id <= this.#lastIncomingId) {
      throw new RpcError('ProtocolViolation', 'RPC request IDs must increase')
    }
    this.#lastIncomingId = frame.id
    if (this.#outgoing.exhausted) {
      this.#send({
        type: 'failure',
        id: frame.id,
        error: { code: 'ResourceLimit', message: 'RPC request IDs are exhausted' },
      })
      return
    }
    if (!endpoint.methods || !Object.hasOwn(endpoint.methods, frame.method)) {
      this.#send({
        type: 'failure',
        id: frame.id,
        error: { code: 'InvalidInput', message: 'Unknown RPC method' },
      })
      this.#closeIfDrained()
      return
    }

    const controller = new AbortController()
    this.#incoming.set(frame.id, controller)
    void this.#execute(
      frame,
      endpoint.methods[frame.method]!,
      controller.signal,
      endpoint.errors ?? defaultErrorCodec,
    )
  }

  async #execute(
    frame: Extract<RpcFrame, { type: 'request' }>,
    method: RpcMethod,
    signal: AbortSignal,
    errors: RpcErrorCodec,
  ): Promise<void> {
    let reply: RpcFrame
    try {
      const result = await method(frame.args, signal)
      if (!this.#active) {
        return
      }
      reply =
        result === undefined
          ? { type: 'success', id: frame.id }
          : { type: 'success', id: frame.id, value: parseJsonValue(result) }
    } catch (cause) {
      if (!this.#active) {
        return
      }

      let error: JsonValue
      try {
        error = parseJsonValue(errors.encode(cause, frame.method))
      } catch {
        error = safeFailure(cause)
      }
      reply = { type: 'failure', id: frame.id, error }
    }

    this.#incoming.delete(frame.id)
    this.#send(reply)
    this.#closeIfDrained()
  }

  #receiveNotification(
    frame: Extract<RpcFrame, { type: 'notify' }>,
    notifications: RpcEndpoint['notifications'],
  ): void {
    if (!notifications || !Object.hasOwn(notifications.topics, frame.topic)) {
      return
    }

    const failed = (error: unknown) => notifications.onError(error, frame.topic)
    try {
      const result = notifications.topics[frame.topic]!(frame.value)
      if (result) {
        result.catch(failed)
      }
    } catch (error) {
      failed(error)
    }
  }

  get #exhausted(): boolean {
    return this.#outgoing.exhausted || this.#lastIncomingId === Number.MAX_SAFE_INTEGER
  }

  #closeIfDrained(): void {
    if (this.#exhausted && this.#incoming.size === 0 && this.#outgoing.idle) {
      this.close()
    }
  }

  #end(reason: RpcError, rejection?: Extract<RpcFrame, { type: 'rejected' }>): void {
    const connection = this.#active
    if (!connection) {
      return
    }
    const { transport } = connection

    this.#active = undefined
    clearTimeout(this.#timer)

    // Stop admission before handing off a final rejection, even if the peer closes during send.
    if (rejection) {
      try {
        transport.send(rejection)
      } catch (cause) {
        reason = connectionClosed(cause)
      }
    }

    this.#rejectReady(reason)
    const lost = reason.code === 'ConnectionClosed' ? reason : connectionClosed(reason)
    this.#outgoing.close(lost)
    for (const controller of this.#incoming.values()) {
      controller.abort(lost)
    }
    this.#incoming.clear()

    try {
      transport.close()
    } catch (cause) {
      this.#resolveClosed(
        new RpcError('ConnectionClosed', 'Failed to release the RPC transport', { cause }),
      )
      return
    }

    this.#resolveClosed(reason)
  }
}
