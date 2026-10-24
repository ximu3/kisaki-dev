/** Subscription shape specimen; event and log payload contracts are not declared here. */
import type {
  MpvNode,
  MpvValue,
  MpvPropertyFormat,
  MpvPropertyValue,
  MpvPropertyNode,
  PropertyState,
  ValueRepresentation
} from '../libmpv-explicit-values/contract.js'

export interface MpvObserver<T> {
  readonly next: (value: T) => void
  readonly error: (error: Error) => void
  /** Normal end of the subscription, not the end of a media file. */
  readonly complete?: () => void
}

export interface MpvSubscription {
  /** No new data callbacks or hook runs; dispose() waits for owned cleanup. */
  readonly closed: boolean
  dispose(): Promise<void>
  [Symbol.asyncDispose](): Promise<void>
}

export interface ObserveOptions {
  readonly output?: ValueRepresentation
  /** Controls creation and the lifetime of the published subscription. */
  readonly signal?: AbortSignal
}

type PropertyName = string | Uint8Array<ArrayBuffer>
type KnownProperty<N extends PropertyName> = N extends 'pause'
  ? boolean
  : N extends 'time-pos'
    ? number
    : MpvValue

export interface MpvSubscriptions {
  observeProperty<N extends PropertyName>(
    name: N,
    observer: MpvObserver<PropertyState<KnownProperty<NoInfer<N>>>>,
    options?: ObserveOptions & { readonly format?: 'node'; readonly output?: 'javascript' }
  ): Promise<MpvSubscription>
  observeProperty<N extends PropertyName>(
    name: N,
    observer: MpvObserver<PropertyState<MpvNode>>,
    options: ObserveOptions & { readonly format?: 'node'; readonly output: 'native' }
  ): Promise<MpvSubscription>
  observeProperty<N extends PropertyName>(
    name: N,
    observer: MpvObserver<PropertyState<KnownProperty<NoInfer<N>> | MpvNode>>,
    options: (ObserveOptions & { readonly format?: 'node' }) | undefined
  ): Promise<MpvSubscription>
  observeProperty<N extends PropertyName, F extends MpvPropertyFormat>(
    name: N,
    observer: MpvObserver<PropertyState<MpvPropertyValue<NoInfer<F>, KnownProperty<NoInfer<N>>>>>,
    options: ObserveOptions & { readonly format: F; readonly output?: 'javascript' }
  ): Promise<MpvSubscription>
  observeProperty<N extends PropertyName, F extends MpvPropertyFormat>(
    name: N,
    observer: MpvObserver<PropertyState<MpvPropertyNode<NoInfer<F>>>>,
    options: ObserveOptions & { readonly format: F; readonly output: 'native' }
  ): Promise<MpvSubscription>
  observeProperty<N extends PropertyName, F extends MpvPropertyFormat>(
    name: N,
    observer: MpvObserver<
      PropertyState<
        MpvPropertyValue<NoInfer<F>, KnownProperty<NoInfer<N>>> | MpvPropertyNode<NoInfer<F>>
      >
    >,
    options: ObserveOptions & { readonly format: F }
  ): Promise<MpvSubscription>
  observeProperty(
    name: PropertyName,
    observer: MpvObserver<void>,
    options: { readonly format: 'none'; readonly signal?: AbortSignal; readonly output?: never }
  ): Promise<MpvSubscription>
  observePropertyText(
    name: PropertyName,
    observer: MpvObserver<PropertyState<string>>,
    options?: ObserveOptions & { readonly output?: 'javascript' }
  ): Promise<MpvSubscription>
  observePropertyText(
    name: PropertyName,
    observer: MpvObserver<PropertyState<Uint8Array<ArrayBuffer>>>,
    options: ObserveOptions & { readonly output: 'native' }
  ): Promise<MpvSubscription>
  observePropertyText(
    name: PropertyName,
    observer: MpvObserver<PropertyState<string | Uint8Array<ArrayBuffer>>>,
    options: ObserveOptions | undefined
  ): Promise<MpvSubscription>
}
