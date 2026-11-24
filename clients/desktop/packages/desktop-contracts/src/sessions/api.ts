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

export type SessionInteraction = 'fail' | 'prompt'

export interface SessionInteractionOptions extends CallOptions {
  readonly interaction?: SessionInteraction
}

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

export interface SessionControls {
  pauseTiming(sessionId: string, call?: CallOptions): Promise<void>

  resumeTiming(sessionId: string, call?: CallOptions): Promise<void>

  focus(sessionId: string, call?: CallOptions): Promise<void>

  close(sessionId: string, call?: CallOptions): Promise<void>
}

export interface GameSessionsApi extends SessionControls {
  open(input: GameOpenInput, call?: SessionInteractionOptions): Promise<GameSession>

  focus(sessionId: string, call?: SessionInteractionOptions): Promise<void>

  terminate(sessionId: string, call?: CallOptions): Promise<void>

  detach(sessionId: string, call?: CallOptions): Promise<void>

  captureImage(sessionId: string, call?: SessionInteractionOptions): Promise<GameImageCapture>
}

export interface AnimeSessionsApi extends SessionControls {
  open(input: AnimeOpenInput, call?: SessionInteractionOptions): Promise<AnimeSession>

  switchFile(
    sessionId: string,
    input: FileSwitchInput<PlaybackPositionInput>,
    call?: CallOptions,
  ): Promise<FileSwitchResult<AnimeSession>>

  seek(sessionId: string, position: PlaybackPositionInput, call?: CallOptions): Promise<number>

  play(sessionId: string, call?: CallOptions): Promise<void>

  pause(sessionId: string, call?: CallOptions): Promise<void>

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

  selectTrack(
    sessionId: string,
    track: PlaybackTrackRef,
    options?: { readonly remember?: boolean },
    call?: CallOptions,
  ): Promise<PlaybackSettingResult>

  getTracks(sessionId: string, call?: CallOptions): Promise<readonly PlaybackTrack[]>

  observeTracks(sessionId: string, listener: Listener<readonly PlaybackTrack[]>): Disposable

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

export interface SessionsApi {
  readonly game: GameSessionsApi
  readonly anime: AnimeSessionsApi
  readonly comic: ComicSessionsApi
  readonly novel: NovelSessionsApi
  readonly recordings: SessionRecordingsApi

  list(call?: CallOptions): Promise<readonly WorkSession[]>

  get(sessionId: string, call?: CallOptions): Promise<WorkSession | null>

  observeAll(listener: Listener<readonly WorkSession[]>): Disposable

  observe(sessionId: string, listener: Listener<WorkSession | null>): Disposable
}

export function parseSessionInteraction(input: unknown = 'fail'): SessionInteraction {
  return parseValue(v.picklist(['fail', 'prompt']), input, 'Invalid session interaction policy')
}
