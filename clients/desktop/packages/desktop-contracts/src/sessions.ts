/** @fileoverview Defines ready work sessions, actual runtime observations, controls, and explicit recording recovery. */

import * as v from 'valibot'
import type { ErrorSummary } from './errors'
import type { CallOptions, Disposable } from './execution'
import type { PreparedImage } from './images'
import type { GameBackupSource } from './library/backups'
import type { FileTrackSelection } from './library/holdings'
import type { WorkRef } from './library/identity'
import type { PlaybackPositionInput } from './library/playback'
import {
  readingPositionSchema,
  type ReadingPosition,
  type ReadingPositionInput,
} from './library/reading'
import { objectSchema } from './schema'
import { nonemptyStringSchema, nonnegativeNumberSchema, parseContract } from './validation'

/** Milliseconds accumulated from confirmed monotonic intervals. graceEndsAt is a UTC display deadline, not the timing clock. */
export interface SessionTiming {
  readonly paused: boolean
  readonly counting: boolean
  readonly elapsedMs: number
  readonly graceEndsAt: number | null
}
/** Unknown foreground does not imply an empty or exited process set. */
export interface GameMonitoringState {
  readonly available: boolean
  readonly foreground: boolean | null
}
/** All positions/delays are seconds; these values describe the actual engine, not a desired saved configuration. */
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
/** A stable source position survives reflow. Nullable progress is a 0–1 display value, never a saved address. */
export interface ReadingState {
  readonly position: ReadingPosition
  readonly progress: number | null
  readonly layout: 'reflowable' | 'fixedLayout'
  readonly reflowing: boolean
}
export interface GameSessionContext {
  readonly sessionId: string
  readonly gameId: string
  readonly launchConfigId: string
  readonly startedAt: number
  readonly saveSource?: Extract<GameBackupSource, { type: 'snapshot' }>
}
export interface AnimeSessionContext {
  readonly sessionId: string
  readonly animeId: string
  readonly fileId: string
  readonly startedAt: number
}
export interface ComicSessionContext {
  readonly sessionId: string
  readonly comicId: string
  readonly fileId: string
  readonly startedAt: number
}
export interface NovelSessionContext {
  readonly sessionId: string
  readonly novelId: string
  readonly fileId: string
  readonly startedAt: number
}
/** A session exists only after the concrete content is ready. Its identity never migrates to another actual file or launch. */
export interface GameSession extends GameSessionContext {
  readonly type: 'game'
  readonly timing: SessionTiming
  readonly monitoring: GameMonitoringState
}
export interface AnimeSession extends AnimeSessionContext {
  readonly type: 'anime'
  readonly timing: SessionTiming
  readonly playback: PlaybackState
  readonly settingsSource: 'file' | 'work' | 'global'
}
export interface ComicSession extends ComicSessionContext {
  readonly type: 'comic'
  readonly timing: SessionTiming
  readonly reading: ReadingState
}
export interface NovelSession extends NovelSessionContext {
  readonly type: 'novel'
  readonly timing: SessionTiming
  readonly reading: ReadingState
}
export type WorkSession = GameSession | AnimeSession | ComicSession | NovelSession
export type FileSession = AnimeSession | ComicSession | NovelSession
/** Normal switching returns ready; previousEnded is legal only as an execution failure's partial result. */
export type FileSwitchResult<Session extends FileSession = FileSession> =
  | { readonly outcome: 'ready'; readonly session: Session }
  | {
      readonly outcome: 'previousEnded'
      readonly previousSessionId: string
      readonly targetFileId: string
    }
/** A runtime track reference is scoped to the actual session and cannot be saved as a persistent selection. */
export interface PlaybackTrackRef {
  readonly type: 'video' | 'audio' | 'subtitle'
  readonly id: string
}
export interface PlaybackTrack {
  readonly ref: PlaybackTrackRef
  readonly title: string | null
  readonly language: string | null
  readonly codec: string | null
  readonly selected: boolean
  readonly fileSelection: FileTrackSelection | null
}
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
/** A saved-only result is a failure partial result; normal completion has adopted the actual setting. */
export type PlaybackSettingResult = {
  readonly sessionId: string
  readonly animeId: string
  readonly fileId: string
} & (
  | { readonly outcome: 'applied'; readonly saved: null }
  | { readonly outcome: 'applied' | 'saved'; readonly saved: SavedPlaybackSetting }
)

type FileOpenTarget<Position> =
  | { readonly fileId?: string; readonly position?: never }
  | { readonly fileId: string; readonly position: Position }
export interface GameOpenInput {
  readonly gameId: string
  readonly launchConfigId?: string
}
export type AnimeOpenInput = { readonly animeId: string } & FileOpenTarget<PlaybackPositionInput> &
  (
    | { readonly episodeId?: string; readonly extraId?: never }
    | { readonly episodeId?: never; readonly extraId?: string }
  )
export type ComicOpenInput = {
  readonly comicId: string
  readonly volumeId?: string
  readonly chapterId?: string
} & FileOpenTarget<ReadingPositionInput>
export type NovelOpenInput = {
  readonly novelId: string
  readonly volumeId?: string
} & FileOpenTarget<ReadingPositionInput>

/** Shared operations apply only to the namespace's actual session type; old IDs never select newer sessions. */
export interface SessionControls {
  /** Pause effective-time recording without pausing content or releasing its use reservation. */
  pauseTiming(sessionId: string, call?: CallOptions): Promise<void>
  /** Remove only the user's timing pause; actual counting still depends on observed conditions. */
  resumeTiming(sessionId: string, call?: CallOptions): Promise<void>
  /** Restore/request focus for the actual content window without starting or resuming it. */
  focus(sessionId: string, call?: CallOptions): Promise<void>
  /** End content, save confirmed records, and release resources. Concurrent closes share completion; an ended ID is idempotent. */
  close(sessionId: string, call?: CallOptions): Promise<void>
}
export interface GameSessionsApi extends SessionControls {
  /** Select or validate the explicit choice, launch, confirm its actual monitored target, and return a ready session. */
  open(input: GameOpenInput, call?: CallOptions): Promise<GameSession>
  /** Explicitly terminate confirmed actual targets and await the same record/resource cleanup as close. */
  terminate(sessionId: string, call?: CallOptions): Promise<void>
  /** Capture the selected actual game window; the caller owns the returned prepared image. */
  captureImage(
    sessionId: string,
    call?: CallOptions,
  ): Promise<{ readonly gameId: string; readonly image: PreparedImage }>
  /** Native quit coordination only: save first, then stop management without ending external processes. */
  detach(sessionId: string, call?: CallOptions): Promise<void>
}
export interface AnimeSessionsApi extends SessionControls {
  /** Open/reuse the constrained actual file and finish initial seeking before returning. */
  open(input: AnimeOpenInput, call?: CallOptions): Promise<AnimeSession>
  /** Prepare the new file before leaving old content; failure after leaving carries previousEnded. */
  switchFile(
    sessionId: string,
    input: { readonly fileId: string; readonly position?: PlaybackPositionInput },
    call?: CallOptions,
  ): Promise<FileSwitchResult<AnimeSession>>
  /** Resume current playback without altering the independent timing-pause choice. */
  play(sessionId: string, call?: CallOptions): Promise<void>
  /** Pause actual playback and await its adoption. */
  pause(sessionId: string, call?: CallOptions): Promise<void>
  /** Seek within the actual current file and return the confirmed second position; start never echoes back. */
  seek(sessionId: string, position: PlaybackPositionInput, call?: CallOptions): Promise<number>
  /** Apply a temporary speed to this file, without persisting or changing another session. */
  setSpeed(sessionId: string, speed: number, call?: CallOptions): Promise<void>
  /** Save application volume memory, then adopt it only in this player; saved-only failures preserve a legal result. */
  setVolume(
    sessionId: string,
    volumePercent: number,
    call?: CallOptions,
  ): Promise<PlaybackSettingResult>
  /** Save application mute memory and adopt only in this player. */
  setMuted(sessionId: string, muted: boolean, call?: CallOptions): Promise<PlaybackSettingResult>
  /** Temporarily show/hide the current subtitles without clearing their selected track. */
  setSubtitlesVisible(sessionId: string, visible: boolean, call?: CallOptions): Promise<void>
  /** Save scale in the session's actual settings source, then adopt only that field. */
  setSubtitleScale(
    sessionId: string,
    scale: number,
    call?: CallOptions,
  ): Promise<PlaybackSettingResult>
  /** Save and adopt the current file's signed audio offset in seconds. */
  setAudioDelay(
    sessionId: string,
    seconds: number,
    call?: CallOptions,
  ): Promise<PlaybackSettingResult>
  /** Save and adopt the current file's signed subtitle offset in seconds. */
  setSubtitleDelay(
    sessionId: string,
    seconds: number,
    call?: CallOptions,
  ): Promise<PlaybackSettingResult>
  /** Read the actual current track catalog, separate from lightweight session state. */
  getTracks(sessionId: string, call?: CallOptions): Promise<readonly PlaybackTrack[]>
  /** Deliver current tracks first, then ordered changes until disposal or session end. */
  observeTracks(sessionId: string, listener: (tracks: readonly PlaybackTrack[]) => void): Disposable
  /** Select the actual track; remember defaults false and is rejected for video tracks before effects. */
  selectTrack(
    sessionId: string,
    track: PlaybackTrackRef,
    options?: { readonly remember?: boolean },
    call?: CallOptions,
  ): Promise<PlaybackSettingResult>
  /** Capture the current verified SDR image and adjacent actual file position in one operation. */
  captureImage(
    sessionId: string,
    call?: CallOptions,
  ): Promise<{
    readonly animeId: string
    readonly fileId: string
    readonly positionSeconds: number
    readonly image: PreparedImage
  }>
}
export interface ComicSessionsApi extends SessionControls {
  /** Open/reuse the constrained actual source, regardless of fixed or reflowable layout. */
  open(input: ComicOpenInput, call?: CallOptions): Promise<ComicSession>
  /** Switch actual sources; partial failure retains only the known previousEnded stage. */
  switchFile(
    sessionId: string,
    input: { readonly fileId: string; readonly position?: ReadingPositionInput },
    call?: CallOptions,
  ): Promise<FileSwitchResult<ComicSession>>
  /** Seek the current document and return its confirmed stable source position. */
  seek(
    sessionId: string,
    position: ReadingPositionInput,
    call?: CallOptions,
  ): Promise<ReadingPosition>
}
export interface NovelSessionsApi extends SessionControls {
  /** Open/reuse the constrained actual source and complete its initial position before publishing a session. */
  open(input: NovelOpenInput, call?: CallOptions): Promise<NovelSession>
  /** Switch actual sources; current-view filters never select the target implicitly. */
  switchFile(
    sessionId: string,
    input: { readonly fileId: string; readonly position?: ReadingPositionInput },
    call?: CallOptions,
  ): Promise<FileSwitchResult<NovelSession>>
  /** Seek the current document and return its confirmed stable source position. */
  seek(
    sessionId: string,
    position: ReadingPositionInput,
    call?: CallOptions,
  ): Promise<ReadingPosition>
}
export type RecordingIssue =
  | { readonly kind: 'activity'; readonly activityId: string; readonly error: ErrorSummary }
  | { readonly kind: 'position'; readonly error: ErrorSummary }
/** Runtime-only unsaved facts survive renderer closure, but do not claim persistence across process loss. */
export interface PendingRecording {
  readonly sessionId: string
  readonly work: WorkRef
  readonly target:
    | { readonly type: 'launchConfig'; readonly launchConfigId: string }
    | { readonly type: 'file'; readonly fileId: string }
  readonly endedAt: number
  readonly activityIds: readonly string[]
  readonly positionPending: boolean
  readonly issues: readonly RecordingIssue[]
}
export interface RecordingRetryResult {
  readonly sessionId: string
  readonly savedActivityIds: readonly string[]
  readonly positionSaved: boolean
  readonly remainingActivityIds: readonly string[]
  readonly positionPending: boolean
  readonly issues: readonly RecordingIssue[]
}
export interface SessionRecordingsApi {
  /** Native management only: read summaries in endedAt/sessionId order without exposing internal snapshots. */
  list(call?: CallOptions): Promise<readonly PendingRecording[]>
  /** Retry only pending units; failures carry the actual saved and remaining units, never replay completed writes. */
  retry(sessionId: string, call?: CallOptions): Promise<RecordingRetryResult>
  /** Discard only explicitly selected uncommitted units after any active short commit finishes. */
  discard(sessionId: string, call?: CallOptions): Promise<void>
  /** Notify that the pending summary collection changed and should be reread. */
  onInvalidated(listener: () => void): Disposable
}
export interface SessionsApi {
  readonly game: GameSessionsApi
  readonly anime: AnimeSessionsApi
  readonly comic: ComicSessionsApi
  readonly novel: NovelSessionsApi
  readonly recordings: SessionRecordingsApi
  /** Read current ready sessions as immutable snapshots, without opening or focusing any content. */
  list(call?: CallOptions): Promise<readonly WorkSession[]>
  /** Read one current session or null; an ended session is absent even when records remain unsaved. */
  get(sessionId: string, call?: CallOptions): Promise<WorkSession | null>
  /** Deliver the full initial collection and subsequent complete snapshots without a read/subscribe gap. */
  observeAll(listener: (sessions: readonly WorkSession[]) => void): Disposable
  /** Deliver current state first; null ends observation. Disposing only stops delivery. */
  observe(sessionId: string, listener: (session: WorkSession | null) => void): Disposable
}

export type GameSessionEnded = GameSessionContext & {
  readonly endedAt: number
  readonly reason: 'exited' | 'interrupted' | 'detached'
  readonly recordingError?: ErrorSummary
}
export type FileSessionEnded<
  Context extends AnimeSessionContext | ComicSessionContext | NovelSessionContext,
> = Context & {
  readonly endedAt: number
  readonly reason: 'stopped' | 'replaced' | 'interrupted'
  readonly recordingError?: ErrorSummary
}

function fileOpenSchema<Entries extends v.ObjectEntries, Position>(
  fields: Entries,
  position: v.GenericSchema<unknown, Position>,
) {
  return v.union([
    objectSchema({ ...fields, fileId: v.exactOptional(nonemptyStringSchema) }),
    objectSchema({ ...fields, fileId: nonemptyStringSchema, position }),
  ])
}
const videoPosition = v.union([v.literal('start'), nonnegativeNumberSchema])
const readingPosition = v.union([v.literal('start'), readingPositionSchema])
const animeOpenSchema = v.union([
  fileOpenSchema(
    { animeId: nonemptyStringSchema, episodeId: v.exactOptional(nonemptyStringSchema) },
    videoPosition,
  ),
  fileOpenSchema(
    { animeId: nonemptyStringSchema, extraId: v.exactOptional(nonemptyStringSchema) },
    videoPosition,
  ),
])
const comicOpenSchema = fileOpenSchema(
  {
    comicId: nonemptyStringSchema,
    volumeId: v.exactOptional(nonemptyStringSchema),
    chapterId: v.exactOptional(nonemptyStringSchema),
  },
  readingPosition,
)
const novelOpenSchema = fileOpenSchema(
  { novelId: nonemptyStringSchema, volumeId: v.exactOptional(nonemptyStringSchema) },
  readingPosition,
)

/** Parse exact open constraints; a position always names its actual file and anime parts remain mutually exclusive. */
export function parseAnimeOpenInput(input: unknown): AnimeOpenInput {
  return parseContract(animeOpenSchema, input, 'anime open input')
}
/** Parse a game target without selecting a different configuration or examining running processes. */
export function parseGameOpenInput(input: unknown): GameOpenInput {
  return parseContract(
    objectSchema({
      gameId: nonemptyStringSchema,
      launchConfigId: v.exactOptional(nonemptyStringSchema),
    }),
    input,
    'game open input',
  )
}
/** Parse comic constraints; actual volume/chapter membership is checked by the operation owner. */
export function parseComicOpenInput(input: unknown): ComicOpenInput {
  return parseContract(comicOpenSchema, input, 'comic open input')
}
/** Parse novel constraints without inferring a volume from a file format or locator. */
export function parseNovelOpenInput(input: unknown): NovelOpenInput {
  return parseContract(novelOpenSchema, input, 'novel open input')
}
