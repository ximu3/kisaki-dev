/** Confirmed stream provider contract; this file contains declarations only. */
export interface MpvStreamRequest<TUri extends string | Uint8Array<ArrayBuffer> = string> {
  readonly uri: TUri
  readonly signal: AbortSignal
}

export interface MpvStreamSource {
  readonly read: (
    maxBytes: number
  ) => Uint8Array<ArrayBuffer> | null | PromiseLike<Uint8Array<ArrayBuffer> | null>
  readonly seek?: (offset: bigint) => void | PromiseLike<void>
  readonly getSize?: () => bigint | null | PromiseLike<bigint | null>
  readonly close: () => void | PromiseLike<void>
}

export type MpvStreamFailure<TUri extends string | Uint8Array<ArrayBuffer> = string> =
  | {
      readonly operation: 'open'
      readonly reason: unknown
      readonly request: MpvStreamRequest<TUri> | null
    }
  | {
      readonly operation: 'read' | 'seek' | 'getSize' | 'close'
      readonly reason: unknown
      readonly request: MpvStreamRequest<TUri>
    }

export interface MpvStreamProvider<TUri extends string | Uint8Array<ArrayBuffer> = string> {
  readonly open: (request: MpvStreamRequest<TUri>) => MpvStreamSource | PromiseLike<MpvStreamSource>
  /** Per-operation failure notification; it does not unregister the protocol. */
  readonly onError: (failure: MpvStreamFailure<TUri>) => void
}
