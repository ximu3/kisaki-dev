import * as v from 'valibot'
import type {
  GameOpenInput,
  AnimeOpenInput,
  ComicOpenInput,
  NovelOpenInput,
  FileSwitchInput,
} from './targets'
import type { CallOptions, Listener, Disposable } from '../operations'
import type { PreparedImage } from '../images'
import { parseValue } from '../validation'
import type {
  ReadingPosition,
  PlaybackPositionInput,
  ReadingPositionInput,
} from '../library/reading'
import type {
  GameSession,
  AnimeSession,
  ComicSession,
  NovelSession,
  WorkSession,
  FileSwitchResult,
} from './state'
import type { PlaybackTrackRef, PlaybackTrack, PlaybackSettingResult } from './playback'
import type { SessionRecordingsApi } from './recordings'

/**
 * Per-call policy for user selection when resolving a session target.
 *
 * Operating-system permission requests follow a separate flow.
 */
export type SessionInteraction = 'fail' | 'prompt'

export interface SessionInteractionOptions extends CallOptions {
  /**
   * Defaults to fail: required user selection rejects with InteractionRequired.
   * Prompt asks only when needed; cancelling the selection rejects with Cancelled.
   */
  readonly interaction?: SessionInteraction
}

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

/**
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
   * If the switch fails after the old session ends, the partial result has outcome `previousEnded`.
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

  /** Runtime references are valid only in this execution. */
  getTracks(sessionId: string, call?: CallOptions): Promise<readonly PlaybackTrack[]>

  /** Delivers the current track list first. Releasing observation leaves playback running. */
  observeTracks(sessionId: string, listener: Listener<readonly PlaybackTrack[]>): Disposable

  /**
   * Captures an image and timestamp from the same actual file before independent encoding and
   * preparation.
   */
  captureImage(sessionId: string, call?: CallOptions): Promise<AnimeImageCapture>
}

export interface ComicSessionsApi extends SessionControls {
  /**
   * Opens usable comic content and completes initial positioning.
   *
   * Ordinary same-file reuse preserves established session state.
   */
  open(input: ComicOpenInput, call?: SessionInteractionOptions): Promise<ComicSession>

  /**
   * Switches comic files and preserves a pause in time tracking.
   *
   * If the switch fails after the old session ends, the partial result has outcome `previousEnded`.
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

export interface NovelSessionsApi extends SessionControls {
  /**
   * Opens usable novel content and completes initial positioning.
   *
   * Ordinary same-file reuse preserves established session state.
   */
  open(input: NovelOpenInput, call?: SessionInteractionOptions): Promise<NovelSession>

  /**
   * Switches novel files and preserves a pause in time tracking.
   *
   * If the switch fails after the old session ends, the partial result has outcome `previousEnded`.
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

export interface SessionsApi {
  readonly game: GameSessionsApi
  readonly anime: AnimeSessionsApi
  readonly comic: ComicSessionsApi
  readonly novel: NovelSessionsApi
  readonly recordings: SessionRecordingsApi

  /** Ended sessions and retained unsaved recordings are outside this collection. */
  list(call?: CallOptions): Promise<readonly WorkSession[]>

  /**
   * Reads a current session snapshot, returning null for an absent or ended identity.
   *
   * The ID never resolves to a later session of the same work.
   */
  get(sessionId: string, call?: CallOptions): Promise<WorkSession | null>

  /** Delivers the current session set and subsequent changes without a read-subscribe gap. */
  observeAll(listener: Listener<readonly WorkSession[]>): Disposable

  /** Delivers current state first. A missing or ended target delivers null and ends observation. */
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
