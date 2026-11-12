/** @fileoverview Defines typed native facts and explicit extension payload contracts, separately from observations and invalidation. */

import type { TaskTerminalStatus } from './tasks'
import type { ScanResult } from './scanner/runs'
import type { ErrorSummary } from './errors'
import type { JsonValue } from './json'
import type { LibraryChanged } from './library/changes'
import type { SessionStartedMap, SessionEndedMap } from './sessions/api'
import type { Disposable } from './operations'
import * as v from 'valibot'
import { parseErrorSummary, DesktopError } from './errors'
import { parseValue, id, timestamp, nonemptyText, parseExternalValue } from './validation'
import { parseScanResult, requireCompleteScanResult } from './scanner/runs'
import { parseJsonValue } from './json'
import { parseLibraryChanged } from './library/changes'
import { parseSessionStarted, parseSessionEnded } from './sessions/api'
import { parseId } from '@kisaki3/extension-distribution/metadata'

/**
 * A terminal scanning fact with the actual report and any failure.
 *
 * The scanning report and managed task can finish separately. This fact does not establish that
 * TaskRun or failed-history persistence succeeded.
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

/**
 * A terminal managed-task fact with its business result and any failure.
 *
 * The notification retains formed results independently of history-persistence success.
 */
export interface TaskFinished<Result = JsonValue> {
  readonly taskRunId: string
  readonly type: string
  readonly status: TaskTerminalStatus
  readonly result: Result | null
  readonly error: ErrorSummary | null
  /** UTC milliseconds since the Unix epoch. */
  readonly finishedAt: number
}

/** Native fact names paired with the snapshots published at their business boundaries. */
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

/** A supported native fact name from the shared event map. */
export type NativeEventName = keyof NativeEventMap

/** A stable owner:localId identity, not an occurrence ID or authority to publish. */
export type ExtensionEventRef = `${string}:${string}`

/** A shared extension-event identity paired with its payload parser. */
export interface ExtensionEventContract<Payload> {
  readonly ref: ExtensionEventRef

  /**
   * Parses an incoming snapshot against the event's payload contract.
   *
   * Invalid input must fail before listener delivery.
   */
  readonly parse: (input: unknown) => Payload
}

/**
 * A fact listener that owns any asynchronous work it accepts.
 *
 * Listener failures are isolated from the publisher and other subscribers.
 */
export type EventListener<Payload> = (payload: Payload) => void | Promise<void>

/** Instance-owned subscriptions to future native and extension facts. */
export interface EventsApi {
  /**
   * Subscribes to future native facts using their associated payload type.
   *
   * Disposal stops delivery while work already accepted by the listener continues under its owner.
   */
  on<K extends NativeEventName>(event: K, listener: EventListener<NativeEventMap[K]>): Disposable

  /**
   * Subscribes through the shared extension payload contract.
   *
   * Invalid payloads and listener failures are isolated. The instance owns the subscription;
   * disposal leaves accepted work under its owner.
   */
  on<Payload>(event: ExtensionEventContract<Payload>, listener: EventListener<Payload>): Disposable
}

/**
 * An instance-owned extension publishing registration.
 *
 * Publication waits for host handoff. Subscriber work remains independently owned after publication
 * or disposal.
 */
export interface ExtensionEventPublisher<Payload> {
  readonly ref: ExtensionEventRef

  /**
   * Validates the payload and hands the fact to the host.
   *
   * Completion does not wait for subscribers' asynchronous work or remote business completion.
   */
  emit(payload: Payload): Promise<void>

  /**
   * Removes this instance's publishing registration idempotently.
   *
   * Accepted subscriber work and later registrations remain independent.
   */
  dispose(): Promise<void>
}

/** Fact subscriptions and publishing registrations for the current extension instance. */
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

const error = v.nullable(v.pipe(v.unknown(), v.transform(parseErrorSummary)))

/**
 * Parses a scanning terminal fact and checks its result and error requirements.
 *
 * Completion requires a complete report. Failure and interruption require a safe error while
 * retaining any legal result already formed.
 */
export function parseScannerFinished(input: unknown): ScannerFinished {
  const value = parseValue(
    v.strictObject({
      scanRunId: id,
      scanConfigId: id,
      status: terminal,
      result: v.nullable(v.pipe(v.unknown(), v.transform(parseScanResult))),
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
 * Parsing the fact does not establish history-persistence success.
 */
export function parseTaskFinished(input: unknown): TaskFinished {
  const value = parseValue(
    v.strictObject({
      taskRunId: id,
      type: nonemptyText,
      status: terminal,
      result: v.pipe(v.unknown(), v.transform(parseJsonValue)),
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

/**
 * Creates a shared subscription contract from an event identity and payload parser.
 *
 * The contract grants no publishing authority and creates no live registration.
 */
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
