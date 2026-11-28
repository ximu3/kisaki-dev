import * as game from './game/tables'
import * as anime from './anime/tables'
import * as comic from './comic/tables'
import * as novel from './novel/tables'

export const directories = {
  game: game.directory,
  anime: anime.directory,
  comic: comic.directory,
  novel: novel.directory,
} as const
export const mediaFiles = { anime: anime.file, comic: comic.file, novel: novel.file } as const
export const profiles = {
  anime: anime.recognitionProfiles,
  comic: comic.recognitionProfiles,
  novel: novel.recognitionProfiles,
} as const
export const defaultDiscovery = { maxDepth: null, include: [], exclude: [] } as const
