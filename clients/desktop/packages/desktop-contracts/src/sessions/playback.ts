import * as v from 'valibot'
import { fromParser, parseValue, nonnegativeNumber, id } from '../validation'
import { DesktopError } from '../errors'
import { parseFileTrackSelection, type FileTrackSelection } from '../library/holdings/preferences'

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

const finite = v.pipe(v.number(), v.finite())

const speed = v.pipe(finite, v.minValue(0.01), v.maxValue(100))

const scale = v.pipe(finite, v.gtValue(0), v.maxValue(100))

const volume = v.pipe(finite, v.minValue(0), v.maxValue(100))

export const playbackStateSchema = v.strictObject({
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
})

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
    value: fromParser(parseFileTrackSelection),
  }),
])

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
