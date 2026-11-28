import * as schema from '../../../../infrastructure/database/schema'

export const mediaFiles = {
  anime: {
    table: schema.animeFiles,
    owner: schema.animeFiles.animeId,
    parts: ['animeEpisode', 'animeExtra'],
  },
  comic: {
    table: schema.comicFiles,
    owner: schema.comicFiles.comicId,
    parts: ['comicVolume', 'comicChapter'],
  },
  novel: {
    table: schema.novelFiles,
    owner: schema.novelFiles.novelId,
    parts: ['novelVolume'],
  },
} as const
