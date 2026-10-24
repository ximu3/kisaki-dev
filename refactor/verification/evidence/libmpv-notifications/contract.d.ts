/** Notification record specimen; this file does not implement a native binding. */
import { MpvBindingError } from '../libmpv-control/errors.js'
import type { ValueRepresentation } from '../libmpv-explicit-values/contract.js'
import type { MpvObserver, MpvSubscription } from '../libmpv-subscriptions/contract.js'

export type MpvEventName =
  | 'shutdown'
  | 'start-file'
  | 'end-file'
  | 'file-loaded'
  | 'client-message'
  | 'video-reconfig'
  | 'audio-reconfig'
  | 'seek'
  | 'playback-restart'
  /** @deprecated Observe idle-active instead. Excluded from the default selection. */
  | 'idle'
  /** @deprecated Observe playback-time instead. Excluded from the default selection. */
  | 'tick'

export type MpvEndFileReason = 'eof' | 'stop' | 'quit' | 'error' | 'redirect' | 'unknown'

type EventRecord<Text> =
  | { readonly type: 'start-file'; readonly playlistEntryId: bigint }
  | {
      readonly type: 'end-file'
      readonly playlistEntryId: bigint
      readonly reason: MpvEndFileReason
      readonly reasonCode: number
      readonly errorCode: number
      readonly playlistInsertId: bigint
      readonly playlistInsertCount: number
    }
  | { readonly type: 'client-message'; readonly args: readonly Text[] }
  | {
      readonly type: Exclude<MpvEventName, 'start-file' | 'end-file' | 'client-message'>
    }

export type MpvEvent = EventRecord<string>
export type MpvNativeEvent = EventRecord<Uint8Array<ArrayBuffer>>

export type MpvLogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'v' | 'debug' | 'trace'

type LogMessage<Text> = {
  readonly type: 'log-message'
  readonly prefix: Text
  readonly level: MpvLogLevel
  readonly levelCode: number
  readonly text: Text
}

export type MpvLogMessage = LogMessage<string>
export type MpvNativeLogMessage = LogMessage<Uint8Array<ArrayBuffer>>

export type MpvLogGap =
  | {
      readonly type: 'gap'
      readonly sources: readonly ['binding']
      readonly droppedCount: bigint
    }
  | {
      readonly type: 'gap'
      readonly sources: readonly ['mpv'] | readonly ['mpv', 'binding']
      readonly droppedCount: null
    }

export type MpvLogRecord = MpvLogMessage | MpvLogGap
export type MpvNativeLogRecord = MpvNativeLogMessage | MpvLogGap

export interface ObserveEventsOptions {
  /** Defaults to the nine non-deprecated ordinary event types. */
  readonly events?: readonly MpvEventName[]
  readonly output?: ValueRepresentation
  readonly signal?: AbortSignal
}

export interface ObserveLogsOptions {
  /** Defaults to info. Includes more severe messages. */
  readonly level?: MpvLogLevel | 'terminal-default'
  readonly output?: ValueRepresentation
  readonly signal?: AbortSignal
}

export interface MpvNotifications {
  observeEvents(
    observer: MpvObserver<MpvEvent>,
    options?: ObserveEventsOptions & { readonly output?: 'javascript' }
  ): Promise<MpvSubscription>
  observeEvents(
    observer: MpvObserver<MpvNativeEvent>,
    options: ObserveEventsOptions & { readonly output: 'native' }
  ): Promise<MpvSubscription>
  observeEvents(
    observer: MpvObserver<MpvEvent | MpvNativeEvent>,
    options: ObserveEventsOptions | undefined
  ): Promise<MpvSubscription>

  observeLogs(
    observer: MpvObserver<MpvLogRecord>,
    options?: ObserveLogsOptions & { readonly output?: 'javascript' }
  ): Promise<MpvSubscription>
  observeLogs(
    observer: MpvObserver<MpvNativeLogRecord>,
    options: ObserveLogsOptions & { readonly output: 'native' }
  ): Promise<MpvSubscription>
  observeLogs(
    observer: MpvObserver<MpvLogRecord | MpvNativeLogRecord>,
    options: ObserveLogsOptions | undefined
  ): Promise<MpvSubscription>
}

export declare class MpvNotificationConversionError extends MpvBindingError {
  private constructor()
  readonly source: 'binding'
  readonly code: 'notificationConversion'
  readonly reason: 'invalidUtf8'
  readonly operation: 'observeEvents' | 'observeLogs' | 'createMpv'
  readonly submitted: true
  /** Returns a fresh copy of the same captured record, without reading mpv again. */
  getNativeNotification(): MpvNativeEvent | MpvNativeLogMessage
}
