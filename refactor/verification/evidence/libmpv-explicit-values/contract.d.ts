/** Design specimen for value representation; this is not a generated addon declaration. */
import { MpvBindingError } from '../libmpv-control/errors.js'
export interface MpvObject {
  readonly [key: string]: MpvValue
}

export type MpvValue =
  | null
  | boolean
  | bigint
  | number
  | string
  | Uint8Array<ArrayBuffer>
  | readonly MpvValue[]
  | MpvObject

export type MpvNode =
  | { readonly format: 'none' }
  | { readonly format: 'flag'; readonly value: boolean }
  | { readonly format: 'int64'; readonly value: bigint }
  | { readonly format: 'double'; readonly value: number }
  | { readonly format: 'string'; readonly value: Uint8Array<ArrayBuffer> }
  | { readonly format: 'byteArray'; readonly value: Uint8Array<ArrayBuffer> }
  | { readonly format: 'array'; readonly value: readonly MpvNode[] }
  | {
      readonly format: 'map'
      readonly value: readonly (readonly [Uint8Array<ArrayBuffer>, MpvNode])[]
    }

export type MpvCommandNode = Extract<MpvNode, { format: 'array' | 'map' }>
export type MpvCommand =
  readonly [name: string, ...args: MpvValue[]] | (MpvObject & { readonly name: string })
export type ValueRepresentation = 'javascript' | 'native'

export type MpvPropertyFormat = 'node' | 'flag' | 'int64' | 'double'
export type MpvPropertyValue<F extends MpvPropertyFormat, T = MpvValue> = F extends 'flag'
  ? boolean
  : F extends 'int64'
    ? bigint
    : F extends 'double'
      ? number
      : T
export type MpvPropertyNode<F extends MpvPropertyFormat> = F extends 'node'
  ? MpvNode
  : Extract<MpvNode, { readonly format: F }>

export interface CallOptions {
  readonly signal?: AbortSignal
}

/** Only these getter hints and the pause write are checked in this specimen. */
type PropertyName = string | Uint8Array<ArrayBuffer>
type KnownProperty<N extends PropertyName> = N extends 'pause'
  ? boolean
  : N extends 'time-pos'
    ? number
    : N extends 'path'
      ? string
      : MpvValue
type KnownWrite<N extends string> = N extends 'pause' ? boolean : MpvValue

export interface MpvValueCalls {
  getProperty<N extends PropertyName>(
    name: N,
    options?: CallOptions & { readonly format?: 'node'; readonly output?: 'javascript' }
  ): Promise<KnownProperty<N>>
  getProperty<N extends PropertyName>(
    name: N,
    options: CallOptions & { readonly format?: 'node'; readonly output: 'native' }
  ): Promise<MpvNode>
  getProperty<N extends PropertyName>(
    name: N,
    options:
      | (CallOptions & { readonly format?: 'node'; readonly output?: ValueRepresentation })
      | undefined
  ): Promise<KnownProperty<N> | MpvNode>
  getProperty<N extends PropertyName, F extends MpvPropertyFormat>(
    name: N,
    options: CallOptions & { readonly format: F; readonly output?: 'javascript' }
  ): Promise<MpvPropertyValue<F, KnownProperty<N>>>
  getProperty<N extends PropertyName, F extends MpvPropertyFormat>(
    name: N,
    options: CallOptions & { readonly format: F; readonly output: 'native' }
  ): Promise<MpvPropertyNode<F>>
  getProperty<N extends PropertyName, F extends MpvPropertyFormat>(
    name: N,
    options: CallOptions & { readonly format: F; readonly output?: ValueRepresentation }
  ): Promise<MpvPropertyValue<F, KnownProperty<N>> | MpvPropertyNode<F>>
  setProperty<N extends string>(
    name: N,
    value: KnownWrite<NoInfer<N>>,
    options?: CallOptions & { readonly input?: 'javascript' }
  ): Promise<void>
  setProperty(
    name: Uint8Array<ArrayBuffer>,
    value: MpvValue,
    options?: CallOptions & { readonly input?: 'javascript' }
  ): Promise<void>
  setProperty(
    name: PropertyName,
    value: MpvNode,
    options: CallOptions & { readonly input: 'native' }
  ): Promise<void>
  command(
    args: MpvCommand,
    options?: CallOptions & { readonly input?: 'javascript'; readonly output?: 'javascript' }
  ): Promise<MpvValue>
  command(
    args: MpvCommand,
    options: CallOptions & { readonly input?: 'javascript'; readonly output: 'native' }
  ): Promise<MpvNode>
  command(
    args: MpvCommand,
    options:
      | (CallOptions & { readonly input?: 'javascript'; readonly output?: ValueRepresentation })
      | undefined
  ): Promise<MpvValue | MpvNode>
  command(
    args: MpvCommandNode,
    options: CallOptions & { readonly input: 'native'; readonly output?: 'javascript' }
  ): Promise<MpvValue>
  command(
    args: MpvCommandNode,
    options: CallOptions & { readonly input: 'native'; readonly output: 'native' }
  ): Promise<MpvNode>
  command(
    args: MpvCommandNode,
    options: CallOptions & { readonly input: 'native'; readonly output?: ValueRepresentation }
  ): Promise<MpvValue | MpvNode>
}

export type PropertyState<T> =
  { readonly status: 'available'; readonly value: T } | { readonly status: 'unavailable' }

export declare class MpvConversionError extends MpvBindingError {
  private constructor()
  readonly source: 'binding'
  readonly code: 'valueConversion'
  readonly reason: 'invalidUtf8' | 'duplicateMapKey' | 'unexpectedShape'
  readonly operation:
    | 'command'
    | 'getProperty'
    | 'getPropertyText'
    | 'observeProperty'
    | 'observePropertyText'
    | 'openStream'
  readonly submitted: true
  /** Copy the retained result without issuing a new native operation. */
  getNativeValue(): MpvNode
}
