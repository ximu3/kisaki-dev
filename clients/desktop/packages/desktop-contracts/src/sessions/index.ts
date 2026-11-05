/** @fileoverview Publishes desktop session operations, opening targets, lifecycle facts and results. */

export * from './api'
export type {
  FilePositionChoice,
  GameOpenInput,
  AnimeOpenInput,
  ComicOpenInput,
  NovelOpenInput,
  FileSwitchInput,
} from './targets'
export {
  parseGameOpenInput,
  parseAnimeOpenInput,
  parseComicOpenInput,
  parseNovelOpenInput,
  parseFileSwitchInput,
  parsePlaybackPositionInput,
  parseReadingPositionInput,
} from './targets'
