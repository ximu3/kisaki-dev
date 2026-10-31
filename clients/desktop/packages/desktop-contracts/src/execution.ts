/** @fileoverview Defines caller cancellation, host-bound execution, and explicitly owned resources. */

/** A caller may request cancellation; identity and interaction permission come from the actual endpoint. */
export interface CallOptions {
  readonly signal?: AbortSignal
}

/** The host's context for one admitted operation, including any delegated work and cleanup. */
export interface ExecutionContext {
  readonly signal: AbortSignal
  readonly allowInteraction: boolean
}

/** A provider/processor/recognizer call can be cancelled but cannot request interactive recovery. */
export interface ParticipationContext {
  readonly signal: AbortSignal
}

/** A local subscription. Disposing stops future delivery and is safe to repeat. */
export interface Disposable {
  dispose(): void
}

/** An owned cross-boundary resource; disposal completes after its promised release. */
export interface AsyncDisposable {
  dispose(): Promise<void>
}

/** A published contribution bound to a real owner. Disposal does not undo already committed work. */
export interface Registration<Reference> extends AsyncDisposable {
  readonly ref: Reference
}

/** A bounded local read. The limit is 1–200; totals are independent of the requested interval. */
export interface ListOptions {
  readonly offset: number
  readonly limit: number
}

/** One coherent read snapshot; an empty interval still reports the real complete total. */
export interface ListResult<Item> {
  readonly items: readonly Item[]
  readonly total: number
}
