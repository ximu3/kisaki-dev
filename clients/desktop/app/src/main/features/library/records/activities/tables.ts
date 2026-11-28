import * as schema from '../../../../infrastructure/database/schema'

export const activityTables = {
  game: { table: schema.gamePlayActivity, owner: schema.gamePlayActivity.gameId },
  anime: { table: schema.animeWatchActivity, owner: schema.animeWatchActivity.animeId },
  comic: { table: schema.comicReadingActivity, owner: schema.comicReadingActivity.comicId },
  novel: { table: schema.novelReadingActivity, owner: schema.novelReadingActivity.novelId },
}
