/** Creation proposal specimen, not the complete Mpv interface or option catalogue. */
import type { MpvNode, MpvValue } from '../libmpv-explicit-values/contract.js'
import type { Mpv } from '../libmpv-control/contract.js'
import type {
  GpuVideoOptions,
  GpuVideoOutput,
  SoftwareVideoOptions,
  SoftwareVideoOutput,
  VideoOutputOptions,
  VideoTarget
} from '../libmpv-video/contract.js'
import type { MpvObserver } from '../libmpv-subscriptions/contract.js'
import type {
  MpvLogLevel,
  MpvLogRecord,
  MpvNativeLogRecord
} from '../libmpv-notifications/contract.js'

type OptionName = string | Uint8Array<ArrayBuffer>
type JavaScriptOption = readonly [name: OptionName, value: MpvValue]
type NativeOption = readonly [name: OptionName, value: MpvNode]

type KnownOption<N extends OptionName> = N extends 'pause' | 'config'
  ? boolean
  : N extends 'volume'
    ? number
    : N extends 'config-dir' | 'hwdec' | 'vid'
      ? string
      : MpvValue

type CheckOptions<T extends readonly JavaScriptOption[]> = {
  readonly [K in keyof T]: T[K] extends readonly [infer N extends OptionName, MpvValue]
    ? readonly [name: N, value: KnownOption<N>]
    : never
}

interface InitializationLogs<T> {
  readonly observer: MpvObserver<T>
  readonly level?: MpvLogLevel | 'terminal-default'
}

type JavaScriptLogs = InitializationLogs<MpvLogRecord> & {
  readonly output?: 'javascript'
}
type NativeLogs = InitializationLogs<MpvNativeLogRecord> & {
  readonly output: 'native'
}
type DynamicLogs = InitializationLogs<MpvLogRecord | MpvNativeLogRecord> & {
  readonly output: 'javascript' | 'native'
}

type CreatedOutput<V> = V extends SoftwareVideoOptions
  ? SoftwareVideoOutput
  : V extends GpuVideoOptions
    ? GpuVideoOutput
    : null

type CreatedMpv<V extends VideoOutputOptions | undefined> = Mpv & {
  readonly videoOutput: CreatedOutput<V>
}

type CheckVideoTarget<T> = T extends VideoTarget
  ? T & Record<Exclude<keyof T, keyof VideoTarget>, never>
  : T

type CheckVideoOptions<V> = V extends SoftwareVideoOptions
  ? V & Record<Exclude<keyof V, keyof SoftwareVideoOptions>, never>
  : V extends GpuVideoOptions
    ? V &
        Record<Exclude<keyof V, keyof GpuVideoOptions>, never> &
        (V extends { readonly target?: infer Target }
          ? { readonly target?: CheckVideoTarget<Target> }
          : {})
    : V

type OutputSelection<V extends VideoOutputOptions | undefined> = {
  readonly videoOutput?: V & CheckVideoOptions<NoInfer<V>>
} & (undefined extends V ? {} : { readonly videoOutput: V })

interface CreateCommon {
  /** Controls creation only; it does not close a successfully returned Mpv. */
  readonly signal?: AbortSignal
}

type JavaScriptCreate<T extends readonly JavaScriptOption[]> = CreateCommon & {
  readonly input?: 'javascript'
  readonly options?: T & CheckOptions<NoInfer<T>>
}
type NativeCreate = CreateCommon & {
  readonly input: 'native'
  readonly options?: readonly NativeOption[]
}

export declare function createMpv(configuration?: undefined): Promise<CreatedMpv<undefined>>
export declare function createMpv<
  const T extends readonly JavaScriptOption[] = readonly [],
  const V extends VideoOutputOptions | undefined = undefined
>(
  configuration: JavaScriptCreate<T> &
    OutputSelection<V> & { readonly initializationLogs?: JavaScriptLogs }
): Promise<CreatedMpv<V>>
export declare function createMpv<
  const T extends readonly JavaScriptOption[],
  const V extends VideoOutputOptions | undefined = undefined
>(
  configuration: JavaScriptCreate<T> &
    OutputSelection<V> & { readonly initializationLogs: NativeLogs }
): Promise<CreatedMpv<V>>
export declare function createMpv<
  const T extends readonly JavaScriptOption[],
  const V extends VideoOutputOptions | undefined = undefined
>(
  configuration: JavaScriptCreate<T> &
    OutputSelection<V> & { readonly initializationLogs: DynamicLogs }
): Promise<CreatedMpv<V>>
export declare function createMpv<const V extends VideoOutputOptions | undefined = undefined>(
  configuration: NativeCreate &
    OutputSelection<V> & { readonly initializationLogs?: JavaScriptLogs }
): Promise<CreatedMpv<V>>
export declare function createMpv<const V extends VideoOutputOptions | undefined = undefined>(
  configuration: NativeCreate & OutputSelection<V> & { readonly initializationLogs: NativeLogs }
): Promise<CreatedMpv<V>>
export declare function createMpv<const V extends VideoOutputOptions | undefined = undefined>(
  configuration: NativeCreate & OutputSelection<V> & { readonly initializationLogs: DynamicLogs }
): Promise<CreatedMpv<V>>
