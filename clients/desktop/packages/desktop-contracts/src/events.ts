/** @fileoverview Defines native facts and instance-owned extension event publication without implicit RPC. */

import type { ErrorSummary } from './errors'
import type { AsyncDisposable, CallOptions, Registration } from './execution'
import type { JsonValue } from './json'
import type { LibraryChangedEvent } from './library/changes'
import type { ScanFinishedEvent } from './scanner/api'
import type {
  AnimeSessionContext,
  ComicSessionContext,
  FileSessionEnded,
  GameSessionContext,
  GameSessionEnded,
  NovelSessionContext,
} from './sessions'

export type TaskFinishedEvent = {
  readonly taskRunId: string
  readonly type: string
  readonly finishedAt: number
} & (
  | { readonly status: 'completed'; readonly result: JsonValue | null }
  | {
      readonly status: 'failed' | 'cancelled' | 'interrupted'
      readonly error: ErrorSummary
      readonly result?: JsonValue
    }
)
/** Names identify committed facts; high-frequency session state stays on the session observation APIs. */
export interface NativeEventMap {
  readonly 'app.ready': { readonly readyAt: number }
  readonly 'library.changed': LibraryChangedEvent
  readonly 'scanner.finished': ScanFinishedEvent
  readonly 'tasks.finished': TaskFinishedEvent
  readonly 'sessions.game.sessionStarted': GameSessionContext
  readonly 'sessions.game.sessionEnded': GameSessionEnded
  readonly 'sessions.anime.sessionStarted': AnimeSessionContext
  readonly 'sessions.anime.sessionEnded': FileSessionEnded<AnimeSessionContext>
  readonly 'sessions.comic.sessionStarted': ComicSessionContext
  readonly 'sessions.comic.sessionEnded': FileSessionEnded<ComicSessionContext>
  readonly 'sessions.novel.sessionStarted': NovelSessionContext
  readonly 'sessions.novel.sessionEnded': FileSessionEnded<NovelSessionContext>
}
/** The publisher belongs to one actual instance; a stable ref alone never grants publication authority. */
export interface EventPublisher<Payload> extends Registration<`${string}:${string}`> {
  /** Hand off this instance's fact; listeners own subsequent work, which is not part of the publishing transaction. */
  emit(payload: Payload, call?: CallOptions): Promise<void>
}
export interface EventsApi {
  /** Subscribe to a declared native fact; subscription acknowledgment precedes return and disposal only stops delivery. */
  on<Name extends keyof NativeEventMap>(
    name: Name,
    listener: (payload: NativeEventMap[Name]) => void | Promise<void>,
    call?: CallOptions,
  ): Promise<AsyncDisposable>
  /** Subscribe to a qualified extension fact under the shared author contract; no private method invocation is implied. */
  on<Payload>(
    ref: `${string}:${string}`,
    listener: (payload: Payload) => void | Promise<void>,
    call?: CallOptions,
  ): Promise<AsyncDisposable>
  /** Define a qualified instance-owned event; duplicate identities fail and native names cannot be claimed. */
  define<Payload>(ref: `${string}:${string}`, call?: CallOptions): Promise<EventPublisher<Payload>>
}
