import type { TaskTerminalStatus } from './tasks'
import type { Disposable } from './operations'
import * as v from 'valibot'
import { parseErrorSummary, DesktopError, type ErrorSummary } from './errors'
import {
  fromParser,
  parseValue,
  id,
  timestamp,
  nonemptyText,
  parseExternalValue,
} from './validation'
import { parseScanResult, requireCompleteScanResult, type ScanResult } from './scanner/runs'
import { parseJsonValue, type JsonValue } from './json'
import { parseLibraryChanged, type LibraryChanged } from './library/changes'
import {
  parseSessionStarted,
  parseSessionEnded,
  type SessionStartedMap,
  type SessionEndedMap,
} from './sessions/state'
import { parseId } from '@kisaki3/extension-distribution/metadata'

/**
 * The scan may finish before its managed task. This event can still be delivered if saving the
 * history fails.
 */
export interface ScannerFinished {
  readonly scanRunId: string
  readonly scanConfigId: string
  readonly status: TaskTerminalStatus
  readonly result: ScanResult | null
  readonly error: ErrorSummary | null
  /** UTC milliseconds since the Unix epoch. */
  readonly finishedAt: number
}

/** The event includes the task result even if saving its history fails. */
export interface TaskFinished<Result = JsonValue> {
  readonly taskRunId: string
  readonly type: string
  readonly status: TaskTerminalStatus
  readonly result: Result | null
  readonly error: ErrorSummary | null
  /** UTC milliseconds since the Unix epoch. */
  readonly finishedAt: number
}

export interface NativeEventMap {
  readonly 'app.ready': {
    /** UTC milliseconds since the Unix epoch. */
    readonly readyAt: number
  }
  readonly 'library.changed': LibraryChanged
  readonly 'scanner.finished': ScannerFinished
  readonly 'tasks.finished': TaskFinished

  readonly 'sessions.game.sessionStarted': SessionStartedMap['game']
  readonly 'sessions.game.sessionEnded': SessionEndedMap['game']

  readonly 'sessions.anime.sessionStarted': SessionStartedMap['anime']
  readonly 'sessions.anime.sessionEnded': SessionEndedMap['anime']

  readonly 'sessions.comic.sessionStarted': SessionStartedMap['comic']
  readonly 'sessions.comic.sessionEnded': SessionEndedMap['comic']

  readonly 'sessions.novel.sessionStarted': SessionStartedMap['novel']
  readonly 'sessions.novel.sessionEnded': SessionEndedMap['novel']
}

export type NativeEventName = keyof NativeEventMap

/** A stable owner:localId identity, not an occurrence ID or authority to publish. */
export type ExtensionEventRef = `${string}:${string}`

export interface ExtensionEventContract<Payload> {
  readonly ref: ExtensionEventRef

  /** Invalid input must fail before listener delivery. */
  readonly parse: (input: unknown) => Payload
}

/**
 * Async work accepted by a listener belongs to it. Listener failures are isolated from the
 * publisher and other subscribers.
 */
export type EventListener<Payload> = (payload: Payload) => void | Promise<void>

export interface EventsApi {
  /**
   * Subscribes to future native facts using their associated payload type.
   *
   * Disposal stops delivery while work already accepted by the listener continues under its owner.
   */
  on<K extends NativeEventName>(event: K, listener: EventListener<NativeEventMap[K]>): Disposable

  /**
   * Invalid payloads and listener failures are isolated. The instance owns the subscription;
   * disposal leaves accepted work under its owner.
   */
  on<Payload>(event: ExtensionEventContract<Payload>, listener: EventListener<Payload>): Disposable
}

/**
 * Publication waits for host handoff. Subscriber work remains independently owned after publication
 * or disposal.
 */
export interface ExtensionEventPublisher<Payload> {
  readonly ref: ExtensionEventRef

  /** Resolves after host handoff. Subscribers may still be working. */
  emit(payload: Payload): Promise<void>

  /**
   * Removes this instance's publishing registration idempotently.
   *
   * Accepted subscriber work and later registrations remain independent.
   */
  dispose(): Promise<void>
}

export interface ExtensionEventsApi extends EventsApi {
  /**
   * Creates a publisher bound to the actual extension owner and instance.
   *
   * The local ID cannot name a native event or another extension's registration.
   */
  define<Payload>(
    localId: string,
    parse: (input: unknown) => Payload,
  ): Promise<ExtensionEventPublisher<Payload>>
}

/**
 * The capability to publish one owner's native fact.
 *
 * Synchronous handoff leaves asynchronous subscriber work independently owned.
 */
export interface NativeEventPublisher<K extends NativeEventName> {
  /** Hands off an established native fact synchronously and isolates subscriber failures. */
  emit(payload: NativeEventMap[K]): void
}

const terminal = v.picklist(['completed', 'failed', 'cancelled', 'interrupted'])

const error = v.nullable(fromParser(parseErrorSummary))

/**
 * Completion requires a complete report. Failure and interruption require a safe error while
 * retaining any legal result already formed.
 */
export function parseScannerFinished(input: unknown): ScannerFinished {
  const value = parseValue(
    v.strictObject({
      scanRunId: id,
      scanConfigId: id,
      status: terminal,
      result: v.nullable(fromParser(parseScanResult)),
      error,
      finishedAt: timestamp,
    }),
    input,
    'Invalid scanner finish event',
  )
  if (value.status === 'completed') {
    requireCompleteScanResult(value.result)
  }
  if ((value.status === 'failed' || value.status === 'interrupted') && value.error === null) {
    throw new DesktopError('InvalidInput', 'A failed scan requires its actual safe error')
  }

  return value
}

/**
 * Parses a task terminal fact, requiring a safe error for failure and interruption.
 *
 * A valid event can describe a task whose history could not be saved.
 */
export function parseTaskFinished(input: unknown): TaskFinished {
  const value = parseValue(
    v.strictObject({
      taskRunId: id,
      type: nonemptyText,
      status: terminal,
      result: fromParser(parseJsonValue),
      error,
      finishedAt: timestamp,
    }),
    input,
    'Invalid task finish event',
  )
  if ((value.status === 'failed' || value.status === 'interrupted') && value.error === null) {
    throw new DesktopError('InvalidInput', 'A failed task requires its actual safe error')
  }

  return value
}

const nativeParsers: { readonly [K in NativeEventName]: (input: unknown) => NativeEventMap[K] } = {
  /** Parses the application's readiness timestamp. */
  'app.ready': (input) =>
    parseValue(v.strictObject({ readyAt: timestamp }), input, 'Invalid application ready event'),
  'library.changed': parseLibraryChanged,
  'scanner.finished': parseScannerFinished,
  'tasks.finished': parseTaskFinished,

  /** Parses a game-session start fact. */
  'sessions.game.sessionStarted': (input) => parseSessionStarted('game', input),
  /** Parses a game-session end fact. */
  'sessions.game.sessionEnded': (input) => parseSessionEnded('game', input),

  /** Parses an anime-session start fact. */
  'sessions.anime.sessionStarted': (input) => parseSessionStarted('anime', input),
  /** Parses an anime-session end fact. */
  'sessions.anime.sessionEnded': (input) => parseSessionEnded('anime', input),

  /** Parses a comic-session start fact. */
  'sessions.comic.sessionStarted': (input) => parseSessionStarted('comic', input),
  /** Parses a comic-session end fact. */
  'sessions.comic.sessionEnded': (input) => parseSessionEnded('comic', input),

  /** Parses a novel-session start fact. */
  'sessions.novel.sessionStarted': (input) => parseSessionStarted('novel', input),
  /** Parses a novel-session end fact. */
  'sessions.novel.sessionEnded': (input) => parseSessionEnded('novel', input),
}

/** Frozen native event names derived from the payload-validator catalog. */
export const nativeEventNames: readonly NativeEventName[] = Object.freeze(
  Object.keys(nativeParsers) as NativeEventName[],
)

/** Parses a name from the supported native fact set. */
export function parseNativeEventName(input: unknown): NativeEventName {
  return parseValue(v.picklist(nativeEventNames), input, 'Unknown native event')
}

/** Parses the payload associated with the exact native event name. */
export function parseNativeEventPayload<K extends NativeEventName>(
  event: K,
  input: unknown,
): NativeEventMap[K] {
  return nativeParsers[parseNativeEventName(event)](input) as NativeEventMap[K]
}

/** Parses an exact extension-owner and local-event identity without case folding. */
export function parseExtensionEventRef(input: unknown): ExtensionEventRef {
  const value = parseValue(nonemptyText, input, 'Invalid extension event reference')
  const parts = value.split(':')
  if (parts.length !== 2) {
    throw new DesktopError(
      'InvalidInput',
      'Extension event references require one owner and local ID',
    )
  }
  parseExternalValue(parseId, parts[0], 'Invalid event owner')
  parseValue(nonemptyText, parts[1], 'Invalid event local identity')
  return value as ExtensionEventRef
}

/** The contract grants no publishing authority and creates no live registration. */
export function extensionEvent<Payload>(
  ref: string,
  parse: (input: unknown) => Payload,
): ExtensionEventContract<Payload> {
  return Object.freeze({ ref: parseExtensionEventRef(ref), parse })
}

/** Applies the author's parser between input and output checks for transferable JSON data. */
export function parseExtensionEventPayload<Payload>(
  contract: ExtensionEventContract<Payload>,
  input: unknown,
): Payload {
  return parseJsonValue(contract.parse(parseJsonValue(input))) as Payload
}
