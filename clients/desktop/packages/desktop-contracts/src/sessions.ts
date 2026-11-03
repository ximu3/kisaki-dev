/** @fileoverview Defines actual work sessions, current-content controls and confirmed partial outcomes without engine handles. */

import * as v from 'valibot'
import { DesktopError, parseErrorSummary } from './errors'
import type { ErrorSummary } from './errors'
import type { PreparedImage } from './images'
import type { CallOptions, Disposable, Listener } from './operations'
import { id, nonnegativeNumber, omitFields, parseValue, timestamp, unique } from './validation'
import { parseGameBackupSource } from './library/backup-formats'
import type { GameBackupSource } from './library/backups'
import { parseWorkRef } from './library/catalog'
import type { WorkRef } from './library/catalog'
import { parseFileTrackSelection } from './library/holdings'
import type { FileTrackSelection } from './library/holdings-values'
import { parseReadingPosition } from './library/reading'
import type {
  PlaybackPositionInput,
  ReadingPosition,
  ReadingPositionInput,
} from './library/reading'

/** elapsedMs includes confirmed unsaved intervals; graceEndsAt is a UTC display deadline, never the timing clock. */
export interface SessionTiming {
  readonly paused: boolean
  readonly counting: boolean
  readonly elapsedMs: number
  readonly graceEndsAt: number | null
}
/** Unknown foreground is independent of reliable process survival observation. No PID or running duplicate is exposed. */
export interface GameMonitoringState {
  readonly available: boolean
  readonly foreground: boolean | null
}
/** Actual adopted playback values, independent of the user's timing pause and persistent configuration. */
export interface PlaybackState {
  readonly positionSeconds: number
  readonly durationSeconds: number | null
  readonly paused: boolean
  readonly buffering: boolean
  readonly seeking: boolean
  readonly atEnd: boolean
  readonly speed: number
  readonly volumePercent: number
  readonly muted: boolean
  readonly subtitlesVisible: boolean
  readonly subtitleScale: number
  readonly audioDelaySeconds: number
  readonly subtitleDelaySeconds: number
}
/** Last confirmed source position survives reflow; progress is nullable display information in [0, 1]. */
export interface ReadingState {
  readonly position: ReadingPosition
  readonly progress: number | null
  readonly layout: 'reflowable' | 'fixedLayout'
  readonly reflowing: boolean
}
/** Fixed launch-time save source; changing the current configuration never changes this snapshot. */
export type SessionSaveSource = Extract<GameBackupSource, { readonly type: 'snapshot' }>
export interface SessionBase {
  readonly sessionId: string
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

/** Policy for one operation's necessary target selection or explicit OS authorization, independent of caller identity. */
export type SessionInteraction = 'fail' | 'prompt'
export interface SessionInteractionOptions extends CallOptions {
  /** Defaults to fail. Prompt permits necessary interaction; it neither forces a dialog nor confirms another business operation. */
  readonly interaction?: SessionInteraction
}

/** Lifecycle facts contain fixed actual context only; they omit timing, controls, engine state and automatic-backup preference. */
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
/** Recording failure is independent of the actual end reason. A detached game has already saved its final recording. */
export type SessionEndedMap = {
  readonly [K in keyof SessionStartedMap]: SessionStartedMap[K] & {
    readonly endedAt: number
    readonly reason: SessionEndReasonMap[K]
    readonly recordingError?: ErrorSummary
  }
}

/** Explicit position, including start, always requires an explicit file identity. All supplied selectors constrain the target. */
export type FilePositionChoice<P> =
  | { readonly fileId?: string; readonly position?: never }
  | { readonly fileId: string; readonly position: P }
export interface GameOpenInput {
  readonly gameId: string
  readonly launchConfigId?: string
}
export type AnimeOpenInput = { readonly animeId: string } & (
  | { readonly episodeId?: string; readonly extraId?: never }
  | { readonly episodeId?: never; readonly extraId: string }
) &
  FilePositionChoice<PlaybackPositionInput>
export type ComicOpenInput = {
  readonly comicId: string
  readonly volumeId?: string
  readonly chapterId?: string
} & FilePositionChoice<ReadingPositionInput>
export type NovelOpenInput = {
  readonly novelId: string
  readonly volumeId?: string
} & FilePositionChoice<ReadingPositionInput>
export interface FileSwitchInput<P> {
  readonly fileId: string
  readonly position?: P
}
/** Only ready is a normal return. previousEnded is a legal failure result and does not claim successful recording/cleanup. */
export type FileSwitchResult<S extends FileSession = FileSession> =
  | { readonly outcome: 'ready'; readonly session: S }
  | {
      readonly outcome: 'previousEnded'
      readonly previousSessionId: string
      readonly targetFileId: string
    }

/** Track identities are opaque and valid only in the current execution; persisted selectors are provided separately. */
export interface PlaybackTrackRef {
  readonly type: 'video' | 'audio' | 'subtitle'
  readonly id: string
}
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
/** Saved describes one committed field, not a configuration snapshot or an inferred current scope. */
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
export type PlaybackSettingResult = {
  readonly sessionId: string
  readonly animeId: string
  readonly fileId: string
} & (
  | { readonly outcome: 'applied'; readonly saved: null }
  | { readonly outcome: 'applied' | 'saved'; readonly saved: SavedPlaybackSetting }
)
export interface GameImageCapture {
  readonly gameId: string
  readonly image: PreparedImage
}
export interface AnimeImageCapture {
  readonly animeId: string
  readonly fileId: string
  readonly positionSeconds: number
  readonly image: PreparedImage
}

/** Safe per-unit recording failure; successfully committed units no longer carry an issue. */
export type RecordingIssue =
  | { readonly kind: 'activity'; readonly activityId: string; readonly error: ErrorSummary }
  | { readonly kind: 'position'; readonly error: ErrorSummary }
export type PendingRecording = {
  readonly sessionId: string
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
/** A complete retry receipt; failed/cancelled execution retains the committed and remaining units in this same shape. */
export interface RecordingRetryResult {
  readonly sessionId: string
  readonly savedActivityIds: readonly string[]
  readonly positionSaved: boolean
  readonly remainingActivityIds: readonly string[]
  readonly positionPending: boolean
  readonly issues: readonly RecordingIssue[]
}

/** Controls target one actual session. Timing never changes playback; close waits for recording and resource completion. */
export interface SessionControls {
  pauseTiming(sessionId: string, call?: CallOptions): Promise<void>
  resumeTiming(sessionId: string, call?: CallOptions): Promise<void>
  focus(sessionId: string, call?: CallOptions): Promise<void>
  /** Repeated active closes share completion; an ended ID succeeds without retrying previously failed recording. */
  close(sessionId: string, call?: CallOptions): Promise<void>
}
export interface GameSessionsApi extends SessionControls {
  /** Resolve only after actual launch, target confirmation and observation; reuse preserves the existing session. */
  open(input: GameOpenInput, call?: SessionInteractionOptions): Promise<GameSession>
  /** Choose from this session's actual windows; unresolved selection/authorization uses this call's explicit policy. */
  focus(sessionId: string, call?: SessionInteractionOptions): Promise<void>
  /** Explicit force termination; normal close never escalates automatically. */
  terminate(sessionId: string, call?: CallOptions): Promise<void>
  /** Native exit coordination only: save before detaching, never send a process termination request. */
  detach(sessionId: string, call?: CallOptions): Promise<void>
  /** Capture actual game content into an independently held image; no implicit pause or annotation. */
  captureImage(sessionId: string, call?: SessionInteractionOptions): Promise<GameImageCapture>
}
export interface AnimeSessionsApi extends SessionControls {
  open(input: AnimeOpenInput, call?: SessionInteractionOptions): Promise<AnimeSession>
  switchFile(
    sessionId: string,
    input: FileSwitchInput<PlaybackPositionInput>,
    call?: CallOptions,
  ): Promise<FileSwitchResult<AnimeSession>>
  /** Return confirmed actual seconds, not the requested start instruction. Seeking never implicitly resumes playback. */
  seek(sessionId: string, position: PlaybackPositionInput, call?: CallOptions): Promise<number>
  play(sessionId: string, call?: CallOptions): Promise<void>
  pause(sessionId: string, call?: CallOptions): Promise<void>
  /** Temporary speed lasts only for this actual file; persistent defaults are separate. */
  setSpeed(sessionId: string, speed: number, call?: CallOptions): Promise<void>
  setSubtitlesVisible(sessionId: string, visible: boolean, call?: CallOptions): Promise<void>
  setVolume(
    sessionId: string,
    volumePercent: number,
    call?: CallOptions,
  ): Promise<PlaybackSettingResult>
  setMuted(sessionId: string, muted: boolean, call?: CallOptions): Promise<PlaybackSettingResult>
  setSubtitleScale(
    sessionId: string,
    scale: number,
    call?: CallOptions,
  ): Promise<PlaybackSettingResult>
  setAudioDelay(
    sessionId: string,
    seconds: number,
    call?: CallOptions,
  ): Promise<PlaybackSettingResult>
  setSubtitleDelay(
    sessionId: string,
    seconds: number,
    call?: CallOptions,
  ): Promise<PlaybackSettingResult>
  /** remember defaults false; video tracks cannot be remembered. Save precedes actual adoption. */
  selectTrack(
    sessionId: string,
    track: PlaybackTrackRef,
    options?: { readonly remember?: boolean },
    call?: CallOptions,
  ): Promise<PlaybackSettingResult>
  getTracks(sessionId: string, call?: CallOptions): Promise<readonly PlaybackTrack[]>
  observeTracks(sessionId: string, listener: Listener<readonly PlaybackTrack[]>): Disposable
  /** Image and seconds come from the same actual file capture before independent encoding/preparation. */
  captureImage(sessionId: string, call?: CallOptions): Promise<AnimeImageCapture>
}
export interface ComicSessionsApi extends SessionControls {
  open(input: ComicOpenInput, call?: SessionInteractionOptions): Promise<ComicSession>
  switchFile(
    sessionId: string,
    input: FileSwitchInput<ReadingPositionInput>,
    call?: CallOptions,
  ): Promise<FileSwitchResult<ComicSession>>
  seek(
    sessionId: string,
    position: ReadingPositionInput,
    call?: CallOptions,
  ): Promise<ReadingPosition>
}
export interface NovelSessionsApi extends SessionControls {
  open(input: NovelOpenInput, call?: SessionInteractionOptions): Promise<NovelSession>
  switchFile(
    sessionId: string,
    input: FileSwitchInput<ReadingPositionInput>,
    call?: CallOptions,
  ): Promise<FileSwitchResult<NovelSession>>
  seek(
    sessionId: string,
    position: ReadingPositionInput,
    call?: CallOptions,
  ): Promise<ReadingPosition>
}
/** Native-only collection, retained for the current process. Discard requires the user's explicit choice. */
export interface SessionRecordingsApi {
  list(call?: CallOptions): Promise<readonly PendingRecording[]>
  retry(sessionId: string, call?: CallOptions): Promise<RecordingRetryResult>
  discard(sessionId: string, call?: CallOptions): Promise<void>
  onInvalidated(listener: () => void): Disposable
}
export interface SessionsApi {
  readonly game: GameSessionsApi
  readonly anime: AnimeSessionsApi
  readonly comic: ComicSessionsApi
  readonly novel: NovelSessionsApi
  readonly recordings: SessionRecordingsApi
  list(call?: CallOptions): Promise<readonly WorkSession[]>
  get(sessionId: string, call?: CallOptions): Promise<WorkSession | null>
  /** Deliver current then changed complete snapshots without a read/subscribe gap; disposal never closes content. */
  observeAll(listener: Listener<readonly WorkSession[]>): Disposable
  /** Null is delivered for a missing/ended target and ends this observation. */
  observe(sessionId: string, listener: Listener<WorkSession | null>): Disposable
}

const finite = v.pipe(v.number(), v.finite())

/** Missing policy means fail without prompting. Invalid explicit values remain InvalidInput; target resolution is the owner's work. */
export function parseSessionInteraction(input: unknown = 'fail'): SessionInteraction {
  return parseValue(v.picklist(['fail', 'prompt']), input, 'Invalid session interaction policy')
}
const speed = v.pipe(finite, v.minValue(0.01), v.maxValue(100))
const scale = v.pipe(finite, v.gtValue(0), v.maxValue(100))
const volume = v.pipe(finite, v.minValue(0), v.maxValue(100))
const readingPosition = v.pipe(v.unknown(), v.transform(parseReadingPosition))
const playbackInput = v.union([v.literal('start'), nonnegativeNumber])
const readingInput = v.union([v.literal('start'), readingPosition])
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

/** Validate one complete actual snapshot without inventing running flags, positions, duration or file ownership. */
export function parseWorkSession(input: unknown): WorkSession {
  const value = parseValue(
    v.variant('type', [game, anime, comic, novel]),
    input,
    'Invalid work session',
  )
  if (
    value.type === 'game' &&
    value.saveSource &&
    value.saveSource.launchConfigId !== value.launchConfigId
  ) {
    throw new DesktopError(
      'InvalidInput',
      'Session save source belongs to another launch configuration',
    )
  }
  return value
}
/** Start facts require confirmed targets and reuse the same launch-time save source as the actual game session. */
export function parseSessionStarted<T extends keyof SessionStartedMap>(
  type: T,
  input: unknown,
): SessionStartedMap[T] {
  const fields: v.ObjectEntries = startedEntries[type]
  const value = parseValue(v.strictObject(fields), input, 'Invalid session start event')
  if (type === 'game') {
    const gameValue = value as SessionStartedMap['game']
    if (gameValue.saveSource && gameValue.saveSource.launchConfigId !== gameValue.launchConfigId) {
      throw new DesktopError(
        'InvalidInput',
        'Session event save source belongs to another launch configuration',
      )
    }
  }
  return value as SessionStartedMap[T]
}
/** A game never emits stopped/replaced; file sessions never emit exited/detached. Failed detach cannot emit an end fact. */
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
  parseSessionStarted(type, omitFields(value, ['endedAt', 'reason', 'recordingError']))
  if (value.reason === 'detached' && value.recordingError !== undefined) {
    throw new DesktopError('InvalidInput', 'A detached game cannot have an unsaved final recording')
  }
  return value as SessionEndedMap[T]
}
/** Validate current-file location input; start remains an instruction until the executor returns actual coordinates. */
export function parsePlaybackPositionInput(input: unknown): PlaybackPositionInput {
  return parseValue(playbackInput, input, 'Invalid playback position')
}
export function parseReadingPositionInput(input: unknown): ReadingPositionInput {
  return parseValue(readingInput, input, 'Invalid reading position input')
}
/** Validate both structural selectors and combinations; actual ownership/availability is resolved by sessions. */
export function parseGameOpenInput(input: unknown): GameOpenInput {
  return parseValue(
    v.strictObject({ gameId: id, launchConfigId: v.exactOptional(id) }),
    input,
    'Invalid game open input',
  )
}
export function parseAnimeOpenInput(input: unknown): AnimeOpenInput {
  const value = parseValue(
    v.strictObject({
      animeId: id,
      episodeId: v.exactOptional(id),
      extraId: v.exactOptional(id),
      fileId: v.exactOptional(id),
      position: v.exactOptional(playbackInput),
    }),
    input,
    'Invalid anime open input',
  )
  if (
    (value.episodeId !== undefined && value.extraId !== undefined) ||
    (value.position !== undefined && value.fileId === undefined)
  ) {
    throw new DesktopError('InvalidInput', 'Conflicting or incomplete anime target constraints')
  }
  return value as AnimeOpenInput
}
export function parseComicOpenInput(input: unknown): ComicOpenInput {
  const value = parseValue(
    v.strictObject({
      comicId: id,
      volumeId: v.exactOptional(id),
      chapterId: v.exactOptional(id),
      fileId: v.exactOptional(id),
      position: v.exactOptional(readingInput),
    }),
    input,
    'Invalid comic open input',
  )
  if (value.position !== undefined && value.fileId === undefined) {
    throw new DesktopError('InvalidInput', 'An explicit position requires a file')
  }
  return value as ComicOpenInput
}
export function parseNovelOpenInput(input: unknown): NovelOpenInput {
  const value = parseValue(
    v.strictObject({
      novelId: id,
      volumeId: v.exactOptional(id),
      fileId: v.exactOptional(id),
      position: v.exactOptional(readingInput),
    }),
    input,
    'Invalid novel open input',
  )
  if (value.position !== undefined && value.fileId === undefined) {
    throw new DesktopError('InvalidInput', 'An explicit position requires a file')
  }
  return value as NovelOpenInput
}
/** A switch fixes the requested file; reading and playback coordinate families cannot cross. */
export function parseFileSwitchInput(
  type: 'anime',
  input: unknown,
): FileSwitchInput<PlaybackPositionInput>
export function parseFileSwitchInput(
  type: 'comic' | 'novel',
  input: unknown,
): FileSwitchInput<ReadingPositionInput>
export function parseFileSwitchInput(
  type: FileSession['type'],
  input: unknown,
): FileSwitchInput<PlaybackPositionInput | ReadingPositionInput> {
  return parseValue(
    v.strictObject({
      fileId: id,
      position: v.exactOptional(type === 'anime' ? playbackInput : readingInput),
    }),
    input,
    'Invalid file switch',
  )
}
/** Parse the complete result family; a caller handling success additionally requires outcome ready. */
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
/** A runtime track ID never conveys its persistent source/index. Video memory is rejected before any side effect. */
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
/** Validate each control using exactly the same ranges as persisted preferences; no silent clamping. */
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
/** saved/null cannot claim a durable partial result; normal completion requires applied at the operation boundary. */
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
/** Validate native pending summaries, exposing no internal baselines or engine objects. */
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
/** Already saved units cannot remain pending; an empty receipt is valid for an idempotent retry of an ended ID. */
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
