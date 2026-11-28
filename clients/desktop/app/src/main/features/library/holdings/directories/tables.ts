import * as schema from '../../../../infrastructure/database/schema'

export const directories = {
  game: { table: schema.gameDirectories, owner: schema.gameDirectories.gameId },
  anime: { table: schema.animeDirectories, owner: schema.animeDirectories.animeId },
  comic: { table: schema.comicDirectories, owner: schema.comicDirectories.comicId },
  novel: { table: schema.novelDirectories, owner: schema.novelDirectories.novelId },
} as const

export const defaultDiscovery = { maxDepth: null, include: [], exclude: [] } as const
