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
  readonly 'app.ready': {
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

export type ExtensionEventRef = `${string}:${string}`

export interface ExtensionEventContract<Payload> {
  readonly ref: ExtensionEventRef

  readonly parse: (input: unknown) => Payload
}

export type EventListener<Payload> = (payload: Payload) => void | Promise<void>

export interface EventsApi {
  on<K extends NativeEventName>(event: K, listener: EventListener<NativeEventMap[K]>): Disposable

  on<Payload>(event: ExtensionEventContract<Payload>, listener: EventListener<Payload>): Disposable
}

export interface ExtensionEventPublisher<Payload> {
  readonly ref: ExtensionEventRef

  emit(payload: Payload): Promise<void>

  dispose(): Promise<void>
}

export interface ExtensionEventsApi extends EventsApi {
  define<Payload>(
    localId: string,
    parse: (input: unknown) => Payload,
  ): Promise<ExtensionEventPublisher<Payload>>
}

export interface NativeEventPublisher<K extends NativeEventName> {
  emit(payload: NativeEventMap[K]): void
}

const terminal = v.picklist(['completed', 'failed', 'cancelled', 'interrupted'])

const error = v.nullable(fromParser(parseErrorSummary))

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

export function parseNativeEventName(input: unknown): NativeEventName {
  return parseValue(v.picklist(nativeEventNames), input, 'Unknown native event')
}

export function parseNativeEventPayload<K extends NativeEventName>(
  event: K,
  input: unknown,
): NativeEventMap[K] {
  return nativeParsers[parseNativeEventName(event)](input) as NativeEventMap[K]
}

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

export function extensionEvent<Payload>(
  ref: string,
  parse: (input: unknown) => Payload,
): ExtensionEventContract<Payload> {
  return Object.freeze({ ref: parseExtensionEventRef(ref), parse })
}

export function parseExtensionEventPayload<Payload>(
  contract: ExtensionEventContract<Payload>,
  input: unknown,
): Payload {
  return parseJsonValue(contract.parse(parseJsonValue(input))) as Payload
}
