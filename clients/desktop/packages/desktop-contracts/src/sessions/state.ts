import * as v from 'valibot'
import { fromParser, parseValue, nonnegativeNumber, id, timestamp } from '../validation'
import { parseReadingPosition, type ReadingPosition } from '../library/reading'
import { parseGameBackupSource, type GameBackupSource } from '../library/holdings/backups/api'
import { DesktopError, parseErrorSummary, type ErrorSummary } from '../errors'
import { type PlaybackState, playbackStateSchema } from './playback'

/**
 * Time counted here is confirmed effective usage. Timing eligibility and user pause are tracked
 * independently.
 */
export interface SessionTiming {
  readonly paused: boolean
  readonly counting: boolean
  readonly elapsedMs: number
  /** UTC display deadline in milliseconds; null means no active grace period. */
  readonly graceEndsAt: number | null
}

/** Game process-observation availability and independently known foreground state. */
export interface GameMonitoringState {
  readonly available: boolean
  readonly foreground: boolean | null
}

/** The position survives reflow; progress is nullable display information from 0 through 1. */
export interface ReadingState {
  readonly position: ReadingPosition
  readonly progress: number | null
  readonly layout: 'reflowable' | 'fixedLayout'
  readonly reflowing: boolean
}

/** Save-source snapshot fixed at game launch and unaffected by later configuration edits. */
export type SessionSaveSource = Extract<GameBackupSource, { readonly type: 'snapshot' }>

/** Actual session identity, start time and timing state shared by all work media. */
export interface SessionBase {
  readonly sessionId: string
  /** UTC milliseconds since the Unix epoch. */
  readonly startedAt: number

  readonly timing: SessionTiming
}

export interface GameSession extends SessionBase {
  readonly type: 'game'
  readonly gameId: string
  readonly launchConfigId: string
  readonly saveSource?: SessionSaveSource

  readonly monitoring: GameMonitoringState
}

export interface AnimeSession extends SessionBase {
  readonly type: 'anime'
  readonly animeId: string
  readonly fileId: string
  readonly settingsSource: 'global' | 'work' | 'file'

  readonly playback: PlaybackState
}

export interface ComicSession extends SessionBase {
  readonly type: 'comic'
  readonly comicId: string
  readonly fileId: string

  readonly reading: ReadingState
}

export interface NovelSession extends SessionBase {
  readonly type: 'novel'
  readonly novelId: string
  readonly fileId: string

  readonly reading: ReadingState
}

export type FileSession = AnimeSession | ComicSession | NovelSession

export type WorkSession = GameSession | FileSession

/**
 * The start event identifies the target at launch. Read the live session for timing and engine
 * controls.
 */
export interface SessionStartedMap {
  readonly game: Pick<
    GameSession,
    'sessionId' | 'gameId' | 'launchConfigId' | 'startedAt' | 'saveSource'
  >
  readonly anime: Pick<AnimeSession, 'sessionId' | 'animeId' | 'fileId' | 'startedAt'>
  readonly comic: Pick<ComicSession, 'sessionId' | 'comicId' | 'fileId' | 'startedAt'>
  readonly novel: Pick<NovelSession, 'sessionId' | 'novelId' | 'fileId' | 'startedAt'>
}

export interface SessionEndReasonMap {
  readonly game: 'exited' | 'interrupted' | 'detached'
  readonly anime: 'stopped' | 'replaced' | 'interrupted'
  readonly comic: 'stopped' | 'replaced' | 'interrupted'
  readonly novel: 'stopped' | 'replaced' | 'interrupted'
}

/** A detached game has already saved its final recording. */
export type SessionEndedMap = {
  readonly [K in keyof SessionStartedMap]: SessionStartedMap[K] & {
    /** UTC milliseconds since the Unix epoch. */
    readonly endedAt: number
    readonly reason: SessionEndReasonMap[K]
    readonly recordingError?: ErrorSummary
  }
}

/**
 * Only ready is a normal return. The previousEnded variant is a partial failure result and does not
 * establish successful recording or cleanup.
 */
export type FileSwitchResult<S extends FileSession = FileSession> =
  | { readonly outcome: 'ready'; readonly session: S }
  | {
      readonly outcome: 'previousEnded'
      readonly previousSessionId: string
      readonly targetFileId: string
    }

const readingPosition = fromParser(parseReadingPosition)

const sourceSnapshot = fromParser((input) => {
  const value = parseGameBackupSource(input)
  if (value.type !== 'snapshot') {
    throw new DesktopError(
      'InvalidInput',
      'Session save sources must be actual launch-time snapshots',
    )
  }

  return value
})

const startedBase = { sessionId: id, startedAt: timestamp }

const startedEntries = {
  game: {
    ...startedBase,
    gameId: id,
    launchConfigId: id,
    saveSource: v.exactOptional(sourceSnapshot),
  },
  anime: { ...startedBase, animeId: id, fileId: id },
  comic: { ...startedBase, comicId: id, fileId: id },
  novel: { ...startedBase, novelId: id, fileId: id },
}

const timing = v.pipe(
  v.strictObject({
    paused: v.boolean(),
    counting: v.boolean(),
    elapsedMs: nonnegativeNumber,
    graceEndsAt: v.nullable(timestamp),
  }),
  v.check(
    (value) =>
      !(value.counting && (value.paused || value.graceEndsAt !== null)) &&
      !(value.paused && value.graceEndsAt !== null),
  ),
)

const base = { sessionId: id, startedAt: timestamp, timing }

const fileBase = { ...base, fileId: id }

const reading = v.strictObject({
  position: readingPosition,
  progress: v.nullable(v.pipe(nonnegativeNumber, v.maxValue(1))),
  layout: v.picklist(['reflowable', 'fixedLayout']),
  reflowing: v.boolean(),
})

const game = v.strictObject({
  ...startedEntries.game,
  timing,
  type: v.literal('game'),
  monitoring: v.strictObject({ available: v.boolean(), foreground: v.nullable(v.boolean()) }),
})

const anime = v.strictObject({
  ...fileBase,
  type: v.literal('anime'),
  animeId: id,
  settingsSource: v.picklist(['global', 'work', 'file']),
  playback: playbackStateSchema,
})

const comic = v.strictObject({ ...fileBase, type: v.literal('comic'), comicId: id, reading })

const novel = v.strictObject({ ...fileBase, type: v.literal('novel'), novelId: id, reading })

function checkSaveSource(session: Pick<GameSession, 'launchConfigId' | 'saveSource'>): void {
  if (session.saveSource && session.saveSource.launchConfigId !== session.launchConfigId) {
    throw new DesktopError(
      'InvalidInput',
      'Session save source belongs to another launch configuration',
    )
  }
}

/**
 * Parses a medium-specific live session snapshot and checks timing and game save-source
 * consistency.
 */
export function parseWorkSession(input: unknown): WorkSession {
  const value = parseValue(
    v.variant('type', [game, anime, comic, novel]),
    input,
    'Invalid work session',
  )
  if (value.type === 'game') {
    checkSaveSource(value)
  }

  return value
}

/**
 * Parses start-event context and checks a game save source against the reported launch
 * configuration.
 */
export function parseSessionStarted<T extends keyof SessionStartedMap>(
  type: T,
  input: unknown,
): SessionStartedMap[T] {
  const fields: v.ObjectEntries = startedEntries[type]
  const value = parseValue(v.strictObject(fields), input, 'Invalid session start event')
  if (type === 'game') {
    checkSaveSource(value as SessionStartedMap['game'])
  }

  return value as SessionStartedMap[T]
}

/** A detached game cannot report unsaved final recording. */
export function parseSessionEnded<T extends keyof SessionEndedMap>(
  type: T,
  input: unknown,
): SessionEndedMap[T] {
  const fields: v.ObjectEntries = {
    ...startedEntries[type],
    endedAt: timestamp,
    reason:
      type === 'game'
        ? v.picklist(['exited', 'interrupted', 'detached'])
        : v.picklist(['stopped', 'replaced', 'interrupted']),
    recordingError: v.exactOptional(fromParser(parseErrorSummary)),
  }
  const value = parseValue(v.strictObject(fields), input, 'Invalid session end event')
  if (type === 'game') {
    checkSaveSource(value as SessionStartedMap['game'])
  }
  if (value.reason === 'detached' && value.recordingError !== undefined) {
    throw new DesktopError('InvalidInput', 'A detached game cannot have an unsaved final recording')
  }

  return value as SessionEndedMap[T]
}

/**
 * Parses a complete file-switch result and checks the ready session's medium.
 *
 * The success boundary additionally requires the ready outcome.
 */
export function parseFileSwitchResult<T extends FileSession['type']>(
  type: T,
  input: unknown,
): FileSwitchResult<Extract<FileSession, { type: T }>> {
  const value = parseValue(
    v.variant('outcome', [
      v.strictObject({
        outcome: v.literal('previousEnded'),
        previousSessionId: id,
        targetFileId: id,
      }),
      v.strictObject({
        outcome: v.literal('ready'),
        session: fromParser(parseWorkSession),
      }),
    ]),
    input,
    'Invalid file switch result',
  )
  if (value.outcome === 'ready' && value.session.type !== type) {
    throw new DesktopError('InvalidInput', 'File switch result has the wrong medium')
  }

  return value as FileSwitchResult<Extract<FileSession, { type: T }>>
}
