/** @fileoverview Owns one handshake, bidirectional message pump and the lifetime of its calls and transport. */

import { connectionClosed, RpcError, safeFailure } from '../errors'
import { hasUnknownWireVersion, parseRpcFrame, rpcWireVersion, type RpcFrame } from '../frames'
import { parseJsonValue, type JsonValue } from '../json'
import type { RpcTransport } from '../transport'
import { defaultErrorCodec, type RpcEndpoint, type RpcErrorCodec, type RpcMethod } from './endpoint'
import { OutgoingCalls } from './outgoing'

/**
 * One handshake-bound, bidirectional RPC connection over an owned transport.
 *
 * The caller awaits ready before issuing calls and observes closed to release endpoint-owned
 * resources. Each instance serves one connection lifetime.
 */
export class RpcConnection {
  #resolveReady!: (context: JsonValue) => void
  #rejectReady!: (error: RpcError) => void
  /** Resolves with the peer's verified context, or rejects if the handshake ends unsuccessfully. */
  readonly ready = new Promise<JsonValue>((resolve, reject) => {
    this.#resolveReady = resolve
    this.#rejectReady = reject
  })

  #resolveClosed!: (reason: RpcError) => void
  /** Resolves once with the local reason when the connection and its listeners have been released. */
  readonly closed = new Promise<RpcError>((resolve) => {
    this.#resolveClosed = resolve
  })

  #transport: RpcTransport | undefined
  #endpoint: RpcEndpoint | undefined
  #established = false
  readonly #timer: ReturnType<typeof setTimeout>

  readonly #outgoing = new OutgoingCalls()
  readonly #incoming = new Map<number, AbortController>()
  #lastIncomingId = 0

  /**
   * Binds transport callbacks and starts the handshake with a ten-second deadline.
   *
   * Handshake and transport failures settle ready and closed through the connection's release path.
   */
  constructor(transport: RpcTransport, endpoint: RpcEndpoint) {
    this.#transport = transport
    this.#endpoint = endpoint
    this.#timer = setTimeout(
      () => this.#end(new RpcError('ConnectionClosed', 'RPC handshake timed out')),
      10_000,
    )

    try {
      transport.start(
        (input) => this.#receive(input),
        (cause) => this.#end(connectionClosed(cause)),
      )
      if (endpoint.handshake.role === 'initiator' && this.#transport) {
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

  /**
   * Invokes a remote method and waits for its result or failure.
   *
   * Requires a completed handshake. A pre-aborted signal sends no request; an in-flight abort
   * requests cancellation and continues waiting for the peer's outcome. Connection loss rejects
   * outstanding waits with ConnectionClosed.
   */
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

  /**
   * Hands a transient topic value to the established transport.
   *
   * Returns after local handoff; remote processing has no acknowledgement. A send failure closes
   * the connection and throws ConnectionClosed.
   */
  notify(topic: string, value: JsonValue): void {
    this.#requireReady()
    if (typeof topic !== 'string') {
      throw new RpcError('InvalidInput', 'Expected a notification topic')
    }
    if (!this.#send({ type: 'notify', topic, value: parseJsonValue(value) })) {
      throw connectionClosed()
    }
  }

  /**
   * Ends the connection and releases its transport synchronously.
   *
   * Rejects outbound waits and aborts inbound method signals. Endpoint-owned cleanup may continue
   * after closure; late results are discarded. Repeated calls have no further effect.
   */
  close(): void {
    this.#end(connectionClosed())
  }

  /** Requires an open transport and a completed handshake before admitting local calls. */
  #requireReady(): void {
    if (!this.#transport) {
      throw connectionClosed()
    }
    if (!this.#established) {
      throw new RpcError('ProtocolViolation', 'RPC handshake is incomplete')
    }
  }

  /**
   * Attempts to send a frame through the bound transport.
   *
   * Returns false after closure or a send failure; send failures also end the connection.
   */
  #send(frame: RpcFrame): boolean {
    if (!this.#transport) {
      return false
    }

    try {
      this.#transport.send(frame)
      return true
    } catch (cause) {
      this.#end(connectionClosed(cause))
      return false
    }
  }

  /**
   * Parses and dispatches one frame for this connection.
   *
   * Ignores traffic after closure. Unexpected frames or correlation failures end the connection; an
   * unsupported wire version rejects an acceptor's handshake before context inspection.
   */
  #receive(input: unknown): void {
    const endpoint = this.#endpoint
    if (!endpoint) {
      return
    }

    try {
      if (
        !this.#established &&
        endpoint.handshake.role === 'acceptor' &&
        hasUnknownWireVersion(input)
      ) {
        this.#rejectHandshake(new RpcError('ProtocolMismatch', 'Unsupported RPC wire version'))
        return
      }

      const frame = parseRpcFrame(input)
      if (!this.#established) {
        this.#handshake(frame, endpoint)
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

  /**
   * Processes a handshake frame according to the endpoint's role and context policy.
   *
   * The acceptor sends acceptance before resolving ready. The initiator resolves ready after
   * checking the accepted context.
   */
  #handshake(frame: RpcFrame, { handshake, protocol }: RpcEndpoint): void {
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

    clearTimeout(this.#timer)
    this.#established = true
    if (!reply || this.#send(reply)) {
      this.#resolveReady(frame.context)
    }
  }

  /** Converts a handshake failure to a safe rejection frame and ends the connection. */
  #rejectHandshake(cause: unknown): void {
    const error = safeFailure(cause)
    this.#end(new RpcError(error.code, error.message, { cause }), { type: 'rejected', error })
  }

  /**
   * Admits an increasing peer request ID and dispatches an owned method.
   *
   * Unknown methods or exhausted local IDs receive a failure reply. Each admitted method receives
   * its own cancellation signal.
   */
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

  /**
   * Runs one admitted method and delivers its result or encoded failure.
   *
   * Uses the endpoint's error codec, falling back to a safe failure value if encoding fails.
   * Completion removes inbound cancellation state; connection closure discards late output.
   */
  async #execute(
    frame: Extract<RpcFrame, { type: 'request' }>,
    method: RpcMethod,
    signal: AbortSignal,
    errors: RpcErrorCodec,
  ): Promise<void> {
    let reply: RpcFrame
    try {
      const result = await method(frame.args, signal)
      if (!this.#transport) {
        return
      }
      reply =
        result === undefined
          ? { type: 'success', id: frame.id }
          : { type: 'success', id: frame.id, value: parseJsonValue(result) }
    } catch (cause) {
      if (!this.#transport) {
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

  /** Dispatches a known notification topic and forwards handler failures to its local reporter. */
  #receiveNotification(
    frame: Extract<RpcFrame, { type: 'notify' }>,
    notifications: RpcEndpoint['notifications'],
  ): void {
    if (!notifications || !Object.hasOwn(notifications.topics, frame.topic)) {
      return
    }

    /** Reports this notification handler's failure together with its topic. */
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

  /** Reports whether either direction has used the largest safe request ID. */
  get #exhausted(): boolean {
    return this.#outgoing.exhausted || this.#lastIncomingId === Number.MAX_SAFE_INTEGER
  }

  /** Closes an ID-exhausted connection once incoming and outgoing calls have settled. */
  #closeIfDrained(): void {
    if (this.#exhausted && this.#incoming.size === 0 && this.#outgoing.idle) {
      this.close()
    }
  }

  /**
   * Releases connection resources and settles its lifetime promises once.
   *
   * Stops admission before an optional rejection is sent, rejects outbound waits with
   * ConnectionClosed, and aborts inbound signals. Transport-release failures become the reason
   * returned by closed; method cleanup remains endpoint-owned.
   */
  #end(reason: RpcError, rejection?: Extract<RpcFrame, { type: 'rejected' }>): void {
    const transport = this.#transport
    if (!transport) {
      return
    }

    this.#transport = undefined
    this.#endpoint = undefined
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
