/** @fileoverview Defines session operations and validates medium-specific intents and committed outcomes. */

import type {
  ReadingPosition,
  PlaybackPositionInput,
  ReadingPositionInput,
} from '../library/reading'
import type {
  GameOpenInput,
  AnimeOpenInput,
  ComicOpenInput,
  NovelOpenInput,
  FileSwitchInput,
} from './targets'
import type { GameBackupSource } from '../library/holdings/backups/api'
import type { CallOptions, Listener, Disposable } from '../operations'
import type { ErrorSummary } from '../errors'
import type { FileTrackSelection } from '../library/holdings/preferences'
import type { PreparedImage } from '../images'
import type { WorkRef } from '../library/catalog'
import { parseValue, nonnegativeNumber, id, timestamp, unique } from '../validation'
import * as v from 'valibot'
import { parseReadingPosition } from '../library/reading'
import { parseGameBackupSource } from '../library/holdings/backups/api'
import { DesktopError, parseErrorSummary } from '../errors'
import { parseFileTrackSelection } from '../library/holdings/preferences'
import { parseWorkRef } from '../library/catalog'

/**
 * Current timing eligibility, user pause and confirmed elapsed usage.
 *
 * Elapsed time includes confirmed unsaved intervals. The grace deadline is display information
 * rather than the timing clock.
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

/** Actual adopted playback state, independent of timing pause and saved configuration. */
export interface PlaybackState {
  readonly positionSeconds: number
  readonly durationSeconds: number | null

  readonly paused: boolean
  readonly buffering: boolean
  readonly seeking: boolean
  readonly atEnd: boolean

  /** Actual playback-rate multiplier. */
  readonly speed: number
  readonly volumePercent: number
  readonly muted: boolean

  readonly subtitlesVisible: boolean
  /** Actual subtitle-size multiplier. */
  readonly subtitleScale: number
  readonly audioDelaySeconds: number
  readonly subtitleDelaySeconds: number
}

/**
 * Confirmed source position and current reading layout state.
 *
 * The position survives reflow; progress is nullable display information from 0 through 1.
 */
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

/**
 * Active game session with its launch context, optional save-source snapshot and monitoring state.
 */
export interface GameSession extends SessionBase {
  readonly type: 'game'
  readonly gameId: string
  readonly launchConfigId: string
  readonly saveSource?: SessionSaveSource

  readonly monitoring: GameMonitoringState
}

/**
 * Active anime file session with its adopted playback configuration source and actual player state.
 */
export interface AnimeSession extends SessionBase {
  readonly type: 'anime'
  readonly animeId: string
  readonly fileId: string
  readonly settingsSource: 'global' | 'work' | 'file'

  readonly playback: PlaybackState
}

/** Active comic file session with confirmed reading position and layout state. */
export interface ComicSession extends SessionBase {
  readonly type: 'comic'
  readonly comicId: string
  readonly fileId: string

  readonly reading: ReadingState
}

/** Active novel file session with confirmed reading position and layout state. */
export interface NovelSession extends SessionBase {
  readonly type: 'novel'
  readonly novelId: string
  readonly fileId: string

  readonly reading: ReadingState
}

/** Active playback or reading session bound to one actual file. */
export type FileSession = AnimeSession | ComicSession | NovelSession

/** Current game, playback or reading session with medium-specific context. */
export type WorkSession = GameSession | FileSession

/**
 * Per-call policy for user selection when resolving a session target.
 *
 * Operating-system permission requests follow a separate flow.
 */
export type SessionInteraction = 'fail' | 'prompt'

/** Call cancellation and an explicit target-selection interaction policy. */
export interface SessionInteractionOptions extends CallOptions {
  /**
   * Defaults to fail: required user selection rejects with InteractionRequired.
   * Prompt asks only when needed; cancelling the selection rejects with Cancelled.
   */
  readonly interaction?: SessionInteraction
}

/**
 * Confirmed start-event context for each work medium.
 *
 * Lifecycle facts retain fixed target information; timing and engine controls remain in live
 * session state.
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

/** Permitted session-end reasons for each work medium. */
export interface SessionEndReasonMap {
  readonly game: 'exited' | 'interrupted' | 'detached'
  readonly anime: 'stopped' | 'replaced' | 'interrupted'
  readonly comic: 'stopped' | 'replaced' | 'interrupted'
  readonly novel: 'stopped' | 'replaced' | 'interrupted'
}

/**
 * Confirmed session-end facts with an independent final-recording failure when applicable.
 *
 * A detached game has already saved its final recording.
 */
export type SessionEndedMap = {
  readonly [K in keyof SessionStartedMap]: SessionStartedMap[K] & {
    /** UTC milliseconds since the Unix epoch. */
    readonly endedAt: number
    readonly reason: SessionEndReasonMap[K]
    readonly recordingError?: ErrorSummary
  }
}

/**
 * File-switch completion or the retained fact that the previous session has ended.
 *
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

/**
 * Opaque track identity valid only in the current playback execution.
 *
 * Persistable source selectors are supplied separately.
 */
export interface PlaybackTrackRef {
  readonly type: 'video' | 'audio' | 'subtitle'
  readonly id: string
}

/** Observed track metadata and selection state with a persistable selector when supported. */
export type PlaybackTrack = {
  readonly ref: PlaybackTrackRef
  readonly title: string | null
  readonly language: string | null
  readonly codec: string | null
  readonly selected: boolean
} & (
  | { readonly ref: PlaybackTrackRef & { readonly type: 'video' }; readonly selection: null }
  | {
      readonly ref: PlaybackTrackRef & { readonly type: 'audio' | 'subtitle' }
      readonly selection: FileTrackSelection | null
    }
)

/** One committed playback setting with its actual persistence scope and value. */
export type SavedPlaybackSetting =
  | { readonly field: 'volumePercent'; readonly scope: 'application'; readonly value: number }
  | { readonly field: 'muted'; readonly scope: 'application'; readonly value: boolean }
  | {
      readonly field: 'audioDelaySeconds' | 'subtitleDelaySeconds'
      readonly scope: 'file'
      readonly value: number
    }
  | {
      readonly field: 'subtitleScale'
      readonly scope: 'global' | 'work' | 'file'
      readonly value: number
    }
  | {
      readonly field: 'audioTrack' | 'subtitleTrack'
      readonly scope: 'file'
      readonly value: FileTrackSelection
    }

/**
 * Actual-session outcome distinguishing successful adoption from a retained committed setting.
 *
 * A saved outcome is a partial failure result; normal completion requires applied.
 */
export type PlaybackSettingResult = {
  readonly sessionId: string
  readonly animeId: string
  readonly fileId: string
} & (
  | { readonly outcome: 'applied'; readonly saved: null }
  | { readonly outcome: 'applied' | 'saved'; readonly saved: SavedPlaybackSetting }
)

/** Captured game image whose preparation hold is owned by the caller. */
export interface GameImageCapture {
  readonly gameId: string
  readonly image: PreparedImage
}

/** Captured anime frame with its exact file and time, held independently by the caller. */
export interface AnimeImageCapture {
  readonly animeId: string
  readonly fileId: string
  readonly positionSeconds: number
  readonly image: PreparedImage
}

/** Safe failure summary for one remaining activity or position recording unit. */
export type RecordingIssue =
  | { readonly kind: 'activity'; readonly activityId: string; readonly error: ErrorSummary }
  | { readonly kind: 'position'; readonly error: ErrorSummary }

/**
 * Confirmed unsaved facts retained after an ended session, with the original work and target
 * context.
 */
export type PendingRecording = {
  readonly sessionId: string
  /** UTC milliseconds since the Unix epoch. */
  readonly endedAt: number
  readonly activityIds: readonly string[]
  readonly positionPending: boolean
  readonly issues: readonly RecordingIssue[]
} & (
  | {
      readonly work: WorkRef<'game'>
      readonly target: { readonly launchConfigId: string }
      readonly positionPending: false
    }
  | {
      readonly work: WorkRef<'anime' | 'comic' | 'novel'>
      readonly target: { readonly fileId: string }
    }
)

/**
 * Receipt separating committed recording units from those still pending.
 *
 * Failed or cancelled retry execution retains both sets in this same result shape.
 */
export interface RecordingRetryResult {
  readonly sessionId: string

  readonly savedActivityIds: readonly string[]
  readonly positionSaved: boolean

  readonly remainingActivityIds: readonly string[]
  readonly positionPending: boolean
  readonly issues: readonly RecordingIssue[]
}

/**
 * Controls addressed to one actual session.
 *
 * Timing pause is independent of playback; close waits for final recording and resource completion.
 */
export interface SessionControls {
  /**
   * Pauses user-controlled accumulation and finishes the current timing interval.
   *
   * Playback and open content remain unchanged.
   */
  pauseTiming(sessionId: string, call?: CallOptions): Promise<void>

  /**
   * Clears the user's timing pause.
   *
   * Accumulation still requires the medium's actual activity and foreground conditions.
   */
  resumeTiming(sessionId: string, call?: CallOptions): Promise<void>

  /**
   * Shows the actual content window and requests operating-system focus while preserving the
   * session and pauses.
   */
  focus(sessionId: string, call?: CallOptions): Promise<void>

  /**
   * Closes the session and waits for final recording and resource completion.
   *
   * Concurrent active closes share completion. An ended ID succeeds without retrying failed
   * recording.
   */
  close(sessionId: string, call?: CallOptions): Promise<void>
}

/** Game launch, window selection, process control and image capture for actual sessions. */
export interface GameSessionsApi extends SessionControls {
  /**
   * Opens or reuses a game session after actual target confirmation and observation.
   *
   * A new session requires successful launch; reuse preserves the established session.
   */
  open(input: GameOpenInput, call?: SessionInteractionOptions): Promise<GameSession>

  /**
   * Focuses a window belonging to the actual game session.
   *
   * Required window selection follows this call's interaction policy.
   */
  focus(sessionId: string, call?: SessionInteractionOptions): Promise<void>

  /**
   * Explicitly force-terminates the game.
   *
   * Ordinary close does not escalate to force termination.
   */
  terminate(sessionId: string, call?: CallOptions): Promise<void>

  /**
   * Saves final recording and detaches monitoring for native exit coordination, leaving the game
   * process running.
   */
  detach(sessionId: string, call?: CallOptions): Promise<void>

  /**
   * Captures actual game content into an independently held image without pausing the session or
   * creating an annotation.
   */
  captureImage(sessionId: string, call?: SessionInteractionOptions): Promise<GameImageCapture>
}

/** Anime file opening, playback control, persisted setting adoption and frame capture. */
export interface AnimeSessionsApi extends SessionControls {
  /**
   * Opens usable playback content and completes initial positioning.
   *
   * Same-file reuse preserves playback and timing state, applying an explicit position in place.
   */
  open(input: AnimeOpenInput, call?: SessionInteractionOptions): Promise<AnimeSession>

  /**
   * Prepares the target file, ends the previous session and waits for recording and resource
   * cleanup.
   *
   * Failure after the old session ends retains previousEnded facts.
   */
  switchFile(
    sessionId: string,
    input: FileSwitchInput<PlaybackPositionInput>,
    call?: CallOptions,
  ): Promise<FileSwitchResult<AnimeSession>>

  /**
   * Seeks within the actual file and returns confirmed seconds.
   *
   * The start instruction resolves to an actual position; seeking preserves playback pause.
   */
  seek(sessionId: string, position: PlaybackPositionInput, call?: CallOptions): Promise<number>

  /**
   * Resumes this file's playback and waits for adoption.
   *
   * Timing eligibility remains independent.
   */
  play(sessionId: string, call?: CallOptions): Promise<void>

  /**
   * Pauses this file's playback and waits for adoption while preserving the user's timing-pause
   * choice.
   */
  pause(sessionId: string, call?: CallOptions): Promise<void>

  /**
   * Applies a temporary playback-rate multiplier for the current file, leaving saved defaults
   * unchanged.
   */
  setSpeed(sessionId: string, speed: number, call?: CallOptions): Promise<void>

  /**
   * Applies subtitle visibility to the current file and waits for adoption without changing saved
   * preferences.
   */
  setSubtitlesVisible(sessionId: string, visible: boolean, call?: CallOptions): Promise<void>

  /**
   * Saves application volume memory from 0 through 100 percent, then applies it to this player.
   *
   * Failure distinguishes saved intent from actual adoption.
   */
  setVolume(
    sessionId: string,
    volumePercent: number,
    call?: CallOptions,
  ): Promise<PlaybackSettingResult>

  /**
   * Saves application mute memory, then applies it to this player.
   *
   * Other open players retain their current state.
   */
  setMuted(sessionId: string, muted: boolean, call?: CallOptions): Promise<PlaybackSettingResult>

  /**
   * Saves subtitle scale in the currently selected complete playback configuration, then applies
   * that field to this player.
   */
  setSubtitleScale(
    sessionId: string,
    scale: number,
    call?: CallOptions,
  ): Promise<PlaybackSettingResult>

  /**
   * Saves the signed audio offset in seconds for this file, then applies it to the actual player.
   */
  setAudioDelay(
    sessionId: string,
    seconds: number,
    call?: CallOptions,
  ): Promise<PlaybackSettingResult>

  /**
   * Saves the signed subtitle offset in seconds for this file, then applies it to the actual
   * player.
   */
  setSubtitleDelay(
    sessionId: string,
    seconds: number,
    call?: CallOptions,
  ): Promise<PlaybackSettingResult>

  /**
   * Selects a current runtime track and optionally remembers its file-specific selector before
   * adoption.
   *
   * Remember defaults to false and is unavailable for video tracks.
   */
  selectTrack(
    sessionId: string,
    track: PlaybackTrackRef,
    options?: { readonly remember?: boolean },
    call?: CallOptions,
  ): Promise<PlaybackSettingResult>

  /**
   * Reads the actual file's tracks and selection state.
   *
   * Runtime references are valid only in this execution.
   */
  getTracks(sessionId: string, call?: CallOptions): Promise<readonly PlaybackTrack[]>

  /**
   * Delivers the current track list and subsequent changes and returns the observation lifetime.
   *
   * Releasing observation preserves selection and playback.
   */
  observeTracks(sessionId: string, listener: Listener<readonly PlaybackTrack[]>): Disposable

  /**
   * Captures an image and timestamp from the same actual file before independent encoding and
   * preparation.
   */
  captureImage(sessionId: string, call?: CallOptions): Promise<AnimeImageCapture>
}

/** Comic file opening, switching and confirmed source-position navigation. */
export interface ComicSessionsApi extends SessionControls {
  /**
   * Opens usable comic content and completes initial positioning.
   *
   * Ordinary same-file reuse preserves established session state.
   */
  open(input: ComicOpenInput, call?: SessionInteractionOptions): Promise<ComicSession>

  /**
   * Prepares and switches the comic file through the shared file-switch lifecycle.
   *
   * Preserves timing pause and retains previousEnded facts on failure after the prior session ends.
   */
  switchFile(
    sessionId: string,
    input: FileSwitchInput<ReadingPositionInput>,
    call?: CallOptions,
  ): Promise<FileSwitchResult<ComicSession>>

  /**
   * Locates within the actual comic file and returns a confirmed persistent position.
   *
   * The start instruction is resolved, and unavailable locations fail.
   */
  seek(
    sessionId: string,
    position: ReadingPositionInput,
    call?: CallOptions,
  ): Promise<ReadingPosition>
}

/** Novel file opening, switching and confirmed source-position navigation. */
export interface NovelSessionsApi extends SessionControls {
  /**
   * Opens usable novel content and completes initial positioning.
   *
   * Ordinary same-file reuse preserves established session state.
   */
  open(input: NovelOpenInput, call?: SessionInteractionOptions): Promise<NovelSession>

  /**
   * Prepares and switches the novel file through the shared file-switch lifecycle.
   *
   * Preserves timing pause and retains previousEnded facts on failure after the prior session ends.
   */
  switchFile(
    sessionId: string,
    input: FileSwitchInput<ReadingPositionInput>,
    call?: CallOptions,
  ): Promise<FileSwitchResult<NovelSession>>

  /**
   * Locates within the actual novel file and returns a confirmed persistent position.
   *
   * The start instruction is resolved, and unavailable locations fail.
   */
  seek(
    sessionId: string,
    position: ReadingPositionInput,
    call?: CallOptions,
  ): Promise<ReadingPosition>
}

/**
 * Native access to unsaved confirmed recording facts retained in the current process.
 *
 * Discarding remaining facts requires the user's explicit choice.
 */
export interface SessionRecordingsApi {
  /**
   * Reads recording facts retained after save failure, independently of active content sessions.
   */
  list(call?: CallOptions): Promise<readonly PendingRecording[]>

  /**
   * Retries retained recording facts and reports committed and remaining units.
   *
   * Retry preserves unresolved work without reopening content or duplicating committed activities.
   */
  retry(sessionId: string, call?: CallOptions): Promise<RecordingRetryResult>

  /**
   * Discards the session's remaining unsaved facts after the user's explicit choice.
   *
   * Already saved records remain intact.
   */
  discard(sessionId: string, call?: CallOptions): Promise<void>

  /**
   * Subscribes to pending-recording invalidation and returns the subscription lifetime.
   *
   * Callers subscribe before reading and refresh the list without implicitly retrying or discarding
   * facts.
   */
  onInvalidated(listener: () => void): Disposable
}

/** Current work-session access, medium-specific controls and native recording recovery. */
export interface SessionsApi {
  readonly game: GameSessionsApi
  readonly anime: AnimeSessionsApi
  readonly comic: ComicSessionsApi
  readonly novel: NovelSessionsApi
  readonly recordings: SessionRecordingsApi

  /**
   * Reads snapshots of current sessions.
   *
   * Ended sessions and retained unsaved recordings are outside this collection.
   */
  list(call?: CallOptions): Promise<readonly WorkSession[]>

  /**
   * Reads a current session snapshot, returning null for an absent or ended identity.
   *
   * The ID never resolves to a later session of the same work.
   */
  get(sessionId: string, call?: CallOptions): Promise<WorkSession | null>

  /**
   * Delivers current and changed complete session snapshots without a read-subscribe gap.
   *
   * Disposal leaves content sessions open.
   */
  observeAll(listener: Listener<readonly WorkSession[]>): Disposable

  /**
   * Delivers current and changed state for one session.
   *
   * Null marks a missing or ended target and ends observation.
   */
  observe(sessionId: string, listener: Listener<WorkSession | null>): Disposable
}

/**
 * Parses target-selection policy, defaulting to fail when omitted.
 *
 * Invalid explicit values report InvalidInput.
 */
export function parseSessionInteraction(input: unknown = 'fail'): SessionInteraction {
  return parseValue(v.picklist(['fail', 'prompt']), input, 'Invalid session interaction policy')
}

const finite = v.pipe(v.number(), v.finite())

const speed = v.pipe(finite, v.minValue(0.01), v.maxValue(100))

const scale = v.pipe(finite, v.gtValue(0), v.maxValue(100))

const volume = v.pipe(finite, v.minValue(0), v.maxValue(100))

const readingPosition = v.pipe(v.unknown(), v.transform(parseReadingPosition))

const sourceSnapshot = v.pipe(
  v.unknown(),
  v.transform((input) => {
    const value = parseGameBackupSource(input)
    if (value.type !== 'snapshot') {
      throw new DesktopError(
        'InvalidInput',
        'Session save sources must be actual launch-time snapshots',
      )
    }

    return value
  }),
)

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
  progress: v.nullable(v.pipe(finite, v.minValue(0), v.maxValue(1))),
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
  playback: v.strictObject({
    positionSeconds: nonnegativeNumber,
    durationSeconds: v.nullable(nonnegativeNumber),

    paused: v.boolean(),
    buffering: v.boolean(),
    seeking: v.boolean(),
    atEnd: v.boolean(),

    speed,
    volumePercent: volume,
    muted: v.boolean(),

    subtitlesVisible: v.boolean(),
    subtitleScale: scale,
    audioDelaySeconds: finite,
    subtitleDelaySeconds: finite,
  }),
})

const comic = v.strictObject({ ...fileBase, type: v.literal('comic'), comicId: id, reading })

const novel = v.strictObject({ ...fileBase, type: v.literal('novel'), novelId: id, reading })

/** Checks that a game session's save-source snapshot belongs to its launch configuration. */
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

/**
 * Parses end-event context with medium-specific reasons and recording state.
 *
 * A detached game cannot report unsaved final recording.
 */
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
    recordingError: v.exactOptional(v.pipe(v.unknown(), v.transform(parseErrorSummary))),
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
        session: v.pipe(v.unknown(), v.transform(parseWorkSession)),
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

/**
 * Parses a runtime track identity and rejects remembered video-track selection.
 *
 * Runtime identity does not encode the persistent source selector.
 */
export function parsePlaybackTrackRef(input: unknown, remember = false): PlaybackTrackRef {
  const value = parseValue(
    v.strictObject({ type: v.picklist(['video', 'audio', 'subtitle']), id }),
    input,
    'Invalid playback track',
  )
  if (remember && value.type === 'video') {
    throw new DesktopError('InvalidInput', 'Video tracks do not support file memory')
  }

  return value
}

/**
 * Parses a control value using the same permitted range as its persisted preference, without
 * clamping.
 */
export function parsePlaybackControlValue(
  field: 'speed' | 'volumePercent' | 'subtitleScale' | 'audioDelaySeconds' | 'subtitleDelaySeconds',
  input: unknown,
): number {
  const schemas = {
    speed,
    volumePercent: volume,
    subtitleScale: scale,
    audioDelaySeconds: finite,
    subtitleDelaySeconds: finite,
  }
  return parseValue(schemas[field], input, 'Invalid playback control value')
}

const saved = v.variant('field', [
  v.strictObject({
    field: v.literal('volumePercent'),
    scope: v.literal('application'),
    value: volume,
  }),
  v.strictObject({
    field: v.literal('muted'),
    scope: v.literal('application'),
    value: v.boolean(),
  }),
  v.strictObject({
    field: v.picklist(['audioDelaySeconds', 'subtitleDelaySeconds']),
    scope: v.literal('file'),
    value: finite,
  }),
  v.strictObject({
    field: v.literal('subtitleScale'),
    scope: v.picklist(['global', 'work', 'file']),
    value: scale,
  }),
  v.strictObject({
    field: v.picklist(['audioTrack', 'subtitleTrack']),
    scope: v.literal('file'),
    value: v.pipe(v.unknown(), v.transform(parseFileTrackSelection)),
  }),
])

/**
 * Parses adoption and persistence outcomes, requiring a committed setting for the saved variant.
 *
 * Normal completion requires applied at the operation boundary.
 */
export function parsePlaybackSettingResult(input: unknown): PlaybackSettingResult {
  const value = parseValue(
    v.strictObject({
      sessionId: id,
      animeId: id,
      fileId: id,
      outcome: v.picklist(['applied', 'saved']),
      saved: v.nullable(saved),
    }),
    input,
    'Invalid playback setting result',
  )
  if (value.outcome === 'saved' && value.saved === null) {
    throw new DesktopError('InvalidInput', 'A saved result requires a committed setting')
  }

  return value as PlaybackSettingResult
}

const ids = v.pipe(
  v.array(id),
  v.check((values) => unique(values, (value) => value)),
)

const issue = v.variant('kind', [
  v.strictObject({
    kind: v.literal('activity'),
    activityId: id,
    error: v.pipe(v.unknown(), v.transform(parseErrorSummary)),
  }),
  v.strictObject({
    kind: v.literal('position'),
    error: v.pipe(v.unknown(), v.transform(parseErrorSummary)),
  }),
])

/** Requires recording issues to identify distinct units still pending in the supplied state. */
function validateRecordingIssues(
  activityIds: readonly string[],
  positionPending: boolean,
  issues: readonly RecordingIssue[],
): void {
  if (
    !unique(issues, (value) =>
      value.kind === 'position' ? 'position' : `activity:${value.activityId}`,
    ) ||
    issues.some((value) =>
      value.kind === 'position' ? !positionPending : !activityIds.includes(value.activityId),
    )
  ) {
    throw new DesktopError(
      'InvalidInput',
      'Recording issues must describe distinct remaining units',
    )
  }
}

/**
 * Parses an ended session's pending-recording summary and checks its target, remaining units and
 * issues.
 */
export function parsePendingRecording(input: unknown): PendingRecording {
  const value = parseValue(
    v.strictObject({
      sessionId: id,
      endedAt: timestamp,
      activityIds: ids,
      positionPending: v.boolean(),
      issues: v.array(issue),
      work: v.pipe(v.unknown(), v.transform(parseWorkRef)),
      target: v.union([v.strictObject({ launchConfigId: id }), v.strictObject({ fileId: id })]),
    }),
    input,
    'Invalid pending recording',
  )
  if (
    (value.work.type === 'game') !== 'launchConfigId' in value.target ||
    (value.work.type === 'game' && value.positionPending) ||
    (value.activityIds.length === 0 && !value.positionPending)
  ) {
    throw new DesktopError(
      'InvalidInput',
      'Pending recording target or remaining units are inconsistent',
    )
  }
  validateRecordingIssues(value.activityIds, value.positionPending, value.issues)
  return value as PendingRecording
}

/**
 * Parses a retry receipt with disjoint saved and remaining units and consistent issues.
 *
 * An empty receipt is valid for an idempotent retry of an ended ID.
 */
export function parseRecordingRetryResult(input: unknown): RecordingRetryResult {
  const value = parseValue(
    v.strictObject({
      sessionId: id,
      savedActivityIds: ids,
      positionSaved: v.boolean(),
      remainingActivityIds: ids,
      positionPending: v.boolean(),
      issues: v.array(issue),
    }),
    input,
    'Invalid recording retry result',
  )
  if (
    value.savedActivityIds.some((key) => value.remainingActivityIds.includes(key)) ||
    (value.positionSaved && value.positionPending)
  ) {
    throw new DesktopError('InvalidInput', 'Committed recording units cannot remain pending')
  }
  validateRecordingIssues(value.remainingActivityIds, value.positionPending, value.issues)
  return value
}
