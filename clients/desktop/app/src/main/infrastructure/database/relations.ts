/** @fileoverview Defines relational read paths over the same formal tables used by ordinary SQL queries. */

import { defineRelations } from 'drizzle-orm'
import * as schema from './schema'

export const relations = defineRelations(schema, (r) => ({
  entries: {
    identities: r.many.entryExternalIdentities({
      from: r.entries.id,
      to: r.entryExternalIdentities.ownerId,
    }),
    game: r.one.games({ from: r.entries.id, to: r.games.entryId }),
    anime: r.one.animes({ from: r.entries.id, to: r.animes.entryId }),
    comic: r.one.comics({ from: r.entries.id, to: r.comics.entryId }),
    novel: r.one.novels({ from: r.entries.id, to: r.novels.entryId }),
    character: r.one.characters({ from: r.entries.id, to: r.characters.entryId }),
    person: r.one.persons({ from: r.entries.id, to: r.persons.entryId }),
    organization: r.one.organizations({ from: r.entries.id, to: r.organizations.entryId }),
  },
  animes: {
    episodes: r.many.animeEpisodes({ from: r.animes.entryId, to: r.animeEpisodes.animeId }),
    extras: r.many.animeExtras({ from: r.animes.entryId, to: r.animeExtras.animeId }),
    files: r.many.animeFiles({ from: r.animes.entryId, to: r.animeFiles.animeId }),
  },
  comics: {
    volumes: r.many.comicVolumes({ from: r.comics.entryId, to: r.comicVolumes.comicId }),
    chapters: r.many.comicChapters({ from: r.comics.entryId, to: r.comicChapters.comicId }),
    files: r.many.comicFiles({ from: r.comics.entryId, to: r.comicFiles.comicId }),
  },
  novels: {
    volumes: r.many.novelVolumes({ from: r.novels.entryId, to: r.novelVolumes.novelId }),
    files: r.many.novelFiles({ from: r.novels.entryId, to: r.novelFiles.novelId }),
  },
}))
