/** @fileoverview Defines the anime activity ranking and verifies its part, file and duration totals. */

import assert from 'node:assert/strict'
import { join } from 'node:path'
import type Database from 'better-sqlite3'

/** Ranks all anime by watched duration and counts both kinds of parts and all files on the page. */
export const animeStatisticsSql = `
  with activity as (
    select anime_id, sum(duration_ms) as duration
    from anime_watch_activity group by anime_id
  ), ranked as (
    select a.entry_id as id, coalesce(activity.duration, 0) as duration
    from animes a left join activity on activity.anime_id = a.entry_id
    order by duration desc, a.entry_id limit 200
  )
  select id, duration,
    (select count(*) from anime_episodes where anime_id = ranked.id) +
    (select count(*) from anime_extras where anime_id = ranked.id) as parts,
    (select count(*) from anime_files where anime_id = ranked.id) as files
  from ranked order by duration desc, id`

/** Checks tied durations and anime with no activity, parts or files, then rolls back the test rows. */
export function verifySparseAnimeStatistics(
  connection: Database.Database,
  directory: string,
): void {
  connection.exec('savepoint sparse_statistics')
  try {
    connection.exec(`
      insert into entries (id, type, name, created_at, updated_at) values
        ('a','anime','A',0,0), ('b','anime','B',0,0), ('c','anime','C',0,0), ('d','anime','D',0,0);
      insert into animes (entry_id) values ('a'), ('b'), ('c'), ('d');
      insert into anime_watch_activity (id, anime_id, started_at, ended_at, duration_ms, context_names)
        values ('1','b',0,30,30,'{"fileName":"b.mkv"}'), ('2','b',30,100,70,'{"fileName":"b.mkv"}'),
               ('3','d',0,100,100,'{"fileName":"d.mkv"}');
      insert into anime_episodes (id, anime_id, created_at, updated_at) values ('episode','d',0,0);
      insert into anime_extras (id, anime_id, created_at, updated_at) values ('extra','d',0,0);
    `)
    connection
      .prepare(`insert into anime_files (id, anime_id, path, created_at, updated_at)
                values ('file-a','a',?,0,0), ('file-d','d',?,0,0)`)
      .run(join(directory, 'a.mkv'), join(directory, 'd.mkv'))

    assert.deepEqual(connection.prepare(animeStatisticsSql).all(), [
      { id: 'b', duration: 100, parts: 0, files: 0 },
      { id: 'd', duration: 100, parts: 2, files: 1 },
      { id: 'a', duration: 0, parts: 0, files: 1 },
      { id: 'c', duration: 0, parts: 0, files: 0 },
    ])
  } finally {
    connection.exec('rollback to sparse_statistics; release sparse_statistics')
  }
}
