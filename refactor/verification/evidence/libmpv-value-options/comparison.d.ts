/** Partial candidate interfaces for comparison, not proposed production exports. */
export interface JavaScriptObject {
  readonly [key: string]: JavaScriptValue
}
export type JavaScriptValue =
  | null
  | boolean
  | bigint
  | number
  | string
  | Uint8Array
  | readonly JavaScriptValue[]
  | JavaScriptObject

export type NativeValue =
  | { readonly format: 'none' }
  | { readonly format: 'flag'; readonly value: boolean }
  | { readonly format: 'int64'; readonly value: bigint }
  | { readonly format: 'double'; readonly value: number }
  | { readonly format: 'string'; readonly bytes: Uint8Array }
  | { readonly format: 'bytes'; readonly bytes: Uint8Array }
  | { readonly format: 'array'; readonly values: readonly NativeValue[] }
  | { readonly format: 'map'; readonly entries: readonly (readonly [Uint8Array, NativeValue])[] }

export type PropertyState<T> =
  | { readonly status: 'available'; readonly value: T }
  | { readonly status: 'unavailable' }

export type JavaScriptProperty<N extends string> = N extends 'pause'
  ? boolean
  : N extends 'time-pos'
    ? number
    : N extends 'path'
      ? string
      : JavaScriptValue

export type NativeProperty<N extends string> = N extends 'pause'
  ? Extract<NativeValue, { format: 'flag' }>
  : N extends 'time-pos'
    ? Extract<NativeValue, { format: 'double' }>
    : N extends 'path'
      ? Extract<NativeValue, { format: 'string' }>
      : NativeValue

export interface ScreenshotShape extends JavaScriptObject {
  readonly w: bigint
  readonly h: bigint
  readonly stride: bigint
  readonly format: 'bgr0' | 'bgra' | 'rgba' | 'rgba64'
  readonly data: Uint8Array
}

/** Only getter, setter, and screenshot result selection are exercised. */
export interface SelectedMpv {
  getProperty<N extends string>(name: N, options?: { output?: 'javascript' }): Promise<JavaScriptProperty<N>>
  getProperty<N extends string>(name: N, options: { output: 'native' }): Promise<NativeProperty<N>>
  getProperty<N extends string>(name: N, options: { output: 'javascript' | 'native' }): Promise<JavaScriptProperty<N> | NativeProperty<N>>
  setProperty<N extends string>(name: N, value: JavaScriptProperty<NoInfer<N>>, options?: { input?: 'javascript' }): Promise<void>
  setProperty(name: string, value: NativeValue, options: { input: 'native' }): Promise<void>
  command(args: readonly ['screenshot-raw'], options?: { output?: 'javascript' }): Promise<ScreenshotShape>
  command(args: readonly ['screenshot-raw'], options: { output: 'native' }): Promise<Extract<NativeValue, { format: 'map' }>>
}

export interface NativeMpv {
  getProperty<N extends string>(name: N): Promise<NativeProperty<N>>
}

export declare class ValueSnapshot<T> {
  private constructor()
  toJavaScript(): T
  toNative(): NativeValue
}

export interface SnapshotMpv {
  getProperty<N extends string>(name: N): Promise<ValueSnapshot<JavaScriptProperty<N>>>
}
