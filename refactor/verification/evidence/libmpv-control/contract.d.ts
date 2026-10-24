/** Confirmed control specimen; complete native implementation remains unverified. */
import type { MpvValueCalls, ValueRepresentation } from '../libmpv-explicit-values/contract.js'
import type { MpvSubscription, MpvSubscriptions } from '../libmpv-subscriptions/contract.js'
import type { MpvNotifications } from '../libmpv-notifications/contract.js'
import type { MpvStreamProvider } from '../libmpv-streams/contract.js'
import type { VideoOutput } from '../libmpv-video/contract.js'

export interface MpvClientApiVersion {
  readonly major: number
  readonly minor: number
}

export declare function getClientApiVersion(): Promise<MpvClientApiVersion>

export interface MpvHookContext {
  /** Aborted when this active execution is stopped; no native continuation token is exposed. */
  readonly signal: AbortSignal
}

export interface MpvHookHandler {
  /** Completion permits the native hook to continue. */
  readonly run: (context: MpvHookContext) => void | PromiseLike<void>
  /** Terminal failure; user rejections retain their original values. */
  readonly error: (reason: unknown) => void
  readonly complete?: () => void
}

export interface MpvHookOptions {
  /** Signed C int, lower first; defaults to zero. */
  readonly priority?: number
  /** Covers registration and the lifetime of the returned subscription. */
  readonly signal?: AbortSignal
}

export interface PropertyTextOptions {
  readonly format?: 'plain' | 'osd'
  readonly output?: ValueRepresentation
  readonly signal?: AbortSignal
}

export interface MpvControl extends MpvValueCalls, MpvSubscriptions, MpvNotifications {
  readonly clientId: bigint
  readonly clientName: string
  getTimeNs(): bigint
  getPropertyText(
    name: string | Uint8Array<ArrayBuffer>,
    options?: PropertyTextOptions & { readonly output?: 'javascript' }
  ): Promise<string>
  getPropertyText(
    name: string | Uint8Array<ArrayBuffer>,
    options: PropertyTextOptions & { readonly output: 'native' }
  ): Promise<Uint8Array<ArrayBuffer>>
  getPropertyText(
    name: string | Uint8Array<ArrayBuffer>,
    options: PropertyTextOptions | undefined
  ): Promise<string | Uint8Array<ArrayBuffer>>
  loadConfigFile(
    path: string | Uint8Array<ArrayBuffer>,
    options?: { readonly signal?: AbortSignal }
  ): Promise<void>
  addHook(
    name: string | Uint8Array<ArrayBuffer>,
    handler: MpvHookHandler,
    options?: MpvHookOptions
  ): Promise<MpvSubscription>
}

export interface MpvClient extends MpvControl {
  dispose(): Promise<void>
  [Symbol.asyncDispose](): Promise<void>
}

export interface Mpv extends MpvControl {
  readonly videoOutput: VideoOutput | null
  registerProtocol(
    name: string | Uint8Array<ArrayBuffer>,
    provider: MpvStreamProvider,
    options?: { readonly output?: 'javascript' }
  ): Promise<void>
  registerProtocol(
    name: string | Uint8Array<ArrayBuffer>,
    provider: MpvStreamProvider<Uint8Array<ArrayBuffer>>,
    options: { readonly output: 'native' }
  ): Promise<void>
  registerProtocol(
    name: string | Uint8Array<ArrayBuffer>,
    provider: MpvStreamProvider<string | Uint8Array<ArrayBuffer>>,
    options: { readonly output?: ValueRepresentation } | undefined
  ): Promise<void>
  createClient(options?: {
    readonly name?: string
    readonly signal?: AbortSignal
  }): Promise<MpvClient>
  ref(): this
  unref(): this
  hasRef(): boolean
  close(): Promise<void>
  [Symbol.asyncDispose](): Promise<void>
}
