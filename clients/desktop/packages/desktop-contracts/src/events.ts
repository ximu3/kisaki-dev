/** @fileoverview Defines typed native facts and explicit extension payload contracts, separately from observations and invalidation. */

import * as v from 'valibot'
import { parseId } from '@kisaki3/extension-distribution/metadata'
import { DesktopError, parseErrorSummary } from './errors'
import type { ErrorSummary } from './errors'
import { parseJsonValue } from './json'
import type { JsonValue } from './json'
import { parseLibraryChanged } from './library/changes'
import type { LibraryChanged } from './library/changes'
import type { Disposable } from './operations'
import { parseScanResult, requireCompleteScanResult } from './scanner'
import type { ScanResult } from './scanner/values'
import { parseSessionEnded, parseSessionStarted } from './sessions'
import type { SessionEndedMap, SessionStartedMap } from './sessions'
import type { TaskTerminalStatus } from './tasks'
import { id, nonemptyText, parseExternalValue, parseValue, timestamp } from './validation'

/** The business report and managed task can finish separately. This fact does not claim a TaskRun or failed history was saved. */
export interface ScannerFinished {
  readonly scanRunId: string
  readonly scanConfigId: string
  readonly status: TaskTerminalStatus
  readonly result: ScanResult | null
  readonly error: ErrorSummary | null
  readonly finishedAt: number
}
export interface TaskFinished<Result = JsonValue> {
  readonly taskRunId: string
  readonly type: string
  readonly status: TaskTerminalStatus
  readonly result: Result | null
  readonly error: ErrorSummary | null
  readonly finishedAt: number
}
export interface NativeEventMap {
  readonly 'app.ready': { readonly readyAt: number }
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
/** Shared author code couples a stable reference with the runtime parser for its actual payload. */
export interface ExtensionEventContract<Payload> {
  readonly ref: ExtensionEventRef
  readonly parse: (input: unknown) => Payload
}
export type EventListener<Payload> = (payload: Payload) => void | Promise<void>
export interface EventsApi {
  on<K extends NativeEventName>(event: K, listener: EventListener<NativeEventMap[K]>): Disposable
  on<Payload>(event: ExtensionEventContract<Payload>, listener: EventListener<Payload>): Disposable
}
/** emit waits for host handoff, not subscribers' later business. Disposing removes this registration, not accepted work. */
export interface ExtensionEventPublisher<Payload> {
  readonly ref: ExtensionEventRef
  emit(payload: Payload): Promise<void>
  dispose(): Promise<void>
}
export interface ExtensionEventsApi extends EventsApi {
  /** Bind the actual owner and instance; localId cannot name a native event or another extension's registration. */
  define<Payload>(
    localId: string,
    parse: (input: unknown) => Payload,
  ): Promise<ExtensionEventPublisher<Payload>>
}
/** An owner receives only its native publishing capability. Synchronous handoff does not wait for asynchronous subscribers. */
export interface NativeEventPublisher<K extends NativeEventName> {
  emit(payload: NativeEventMap[K]): void
}

const terminal = v.picklist(['completed', 'failed', 'cancelled', 'interrupted'])
const error = v.nullable(v.pipe(v.unknown(), v.transform(parseErrorSummary)))
/** Completed scanning requires a complete report; a terminal failure retains any already formed legal result independently. */
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
/** Validate short-lived task facts without asserting that the same terminal data was successfully persisted. */
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
  'app.ready': (input) =>
    parseValue(v.strictObject({ readyAt: timestamp }), input, 'Invalid application ready event'),
  'library.changed': parseLibraryChanged,
  'scanner.finished': parseScannerFinished,
  'tasks.finished': parseTaskFinished,
  'sessions.game.sessionStarted': (input) => parseSessionStarted('game', input),
  'sessions.game.sessionEnded': (input) => parseSessionEnded('game', input),
  'sessions.anime.sessionStarted': (input) => parseSessionStarted('anime', input),
  'sessions.anime.sessionEnded': (input) => parseSessionEnded('anime', input),
  'sessions.comic.sessionStarted': (input) => parseSessionStarted('comic', input),
  'sessions.comic.sessionEnded': (input) => parseSessionEnded('comic', input),
  'sessions.novel.sessionStarted': (input) => parseSessionStarted('novel', input),
  'sessions.novel.sessionEnded': (input) => parseSessionEnded('novel', input),
}
export const nativeEventNames: readonly NativeEventName[] = Object.freeze(
  Object.keys(nativeParsers) as NativeEventName[],
)
/** Select only a closed native name before accepting its associated payload. */
export function parseNativeEventName(input: unknown): NativeEventName {
  return parseValue(v.picklist(nativeEventNames), input, 'Unknown native event')
}
export function parseNativeEventPayload<K extends NativeEventName>(
  event: K,
  input: unknown,
): NativeEventMap[K] {
  return nativeParsers[parseNativeEventName(event)](input) as NativeEventMap[K]
}
/** Parse one exact owner/local identity; neither case folding nor native-name aliases are permitted. */
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
/** Create the pure shared contract used by subscribers; this does not register, publish or authorize an event. */
export function extensionEvent<Payload>(
  ref: string,
  parse: (input: unknown) => Payload,
): ExtensionEventContract<Payload> {
  return Object.freeze({ ref: parseExtensionEventRef(ref), parse })
}
/** Apply the author parser and enforce transferable ordinary data, never treating an arbitrary object as a typed payload. */
export function parseExtensionEventPayload<Payload>(
  contract: ExtensionEventContract<Payload>,
  input: unknown,
): Payload {
  return parseJsonValue(contract.parse(parseJsonValue(input))) as Payload
}
