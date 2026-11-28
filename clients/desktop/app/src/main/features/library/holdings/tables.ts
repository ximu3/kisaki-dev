import * as s from '../../../infrastructure/database/schema'

export const directories = {
  game: { table: s.gameDirectories, owner: s.gameDirectories.gameId },
  anime: { table: s.animeDirectories, owner: s.animeDirectories.animeId },
  comic: { table: s.comicDirectories, owner: s.comicDirectories.comicId },
  novel: { table: s.novelDirectories, owner: s.novelDirectories.novelId },
} as const
export const mediaFiles = {
  anime: {
    table: s.animeFiles,
    owner: s.animeFiles.animeId,
    activity: s.animeWatchActivity,
    annotation: s.animeAnnotations,
    parts: ['animeEpisode', 'animeExtra'],
  },
  comic: {
    table: s.comicFiles,
    owner: s.comicFiles.comicId,
    activity: s.comicReadingActivity,
    annotation: s.comicAnnotations,
    parts: ['comicVolume', 'comicChapter'],
  },
  novel: {
    table: s.novelFiles,
    owner: s.novelFiles.novelId,
    activity: s.novelReadingActivity,
    annotation: s.novelAnnotations,
    parts: ['novelVolume'],
  },
} as const
export const profiles = {
  anime: s.animeFileRecognitionProfiles,
  comic: s.comicFileRecognitionProfiles,
  novel: s.novelFileRecognitionProfiles,
} as const
export const defaultDiscovery = { maxDepth: null, include: [], exclude: [] } as const
