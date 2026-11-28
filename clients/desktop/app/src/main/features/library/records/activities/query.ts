import { sql, type SQL } from 'drizzle-orm'
import * as v from 'valibot'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parsePartRef,
  parseWorkRef,
  workTypes,
  type ActivitiesApi,
  type ActivityFilter,
  type WorkType,
} from '@kisaki3/desktop-contracts/library'
import type { LibraryDatabase } from '../../transaction'
import { requireEntry } from '../../entries/tables'
import { requirePart } from '../../parts/write'
import { statisticsScope, workSet } from '../scope'

export type ActivityStatsQuery = Parameters<ActivitiesApi['statistics']>[0]
const id = v.pipe(v.string(), v.nonEmpty()),
  integer = v.pipe(v.number(), v.safeInteger())
const filter = v.variant('type', [
  v.strictObject({ type: v.literal('work'), work: v.unknown() }),
  v.strictObject({ type: v.literal('file'), work: v.unknown(), fileId: id }),
  v.strictObject({ type: v.literal('launchConfig'), gameId: id, launchConfigId: id }),
  v.strictObject({ type: v.literal('part'), part: v.unknown() }),
])
export function activityQuery(input: unknown, stats: boolean): ActivityStatsQuery {
  const result = v.safeParse(
    v.strictObject({
      scope: v.unknown(),
      context: v.exactOptional(filter),
      range: v.exactOptional(v.strictObject({ from: integer, to: integer })),
      groupBy: v.exactOptional(v.picklist(['hour', 'day', 'week', 'month', 'year'])),
    }),
    input,
  )
  if (!result.success || (!stats && result.output.groupBy !== undefined)) {
    throw new DesktopError('InvalidInput', 'Invalid activity query')
  }
  const { scope, range, groupBy } = result.output
  if (range && range.from >= range.to) {
    throw new DesktopError('InvalidInput', 'The time range must have positive length')
  }
  const value = result.output.context
  let context: ActivityFilter | undefined
  if (value?.type === 'file') {
    const work = parseWorkRef(value.work)
    if (work.type === 'game') {
      throw new DesktopError('InvalidReference', 'This work has no reading or video files')
    }
    context = { type: 'file', work: { type: work.type, id: work.id }, fileId: value.fileId }
  }
  if (value?.type === 'work') {
    context = { type: 'work', work: parseWorkRef(value.work) }
  }
  if (value?.type === 'part') {
    context = { type: 'part', part: parsePartRef(value.part) }
  }
  if (value?.type === 'launchConfig') {
    context = value
  }
  return {
    scope: statisticsScope(scope),
    ...(range && { range }),
    ...(context && { context }),
    ...(groupBy && { groupBy }),
  }
}

export const sources = {
  game: ['game_play_activity', 'game_id'],
  anime: ['anime_watch_activity', 'anime_id'],
  comic: ['comic_reading_activity', 'comic_id'],
  novel: ['novel_reading_activity', 'novel_id'],
} as const
const partContext = {
  animeEpisode: 'episode_id',
  animeExtra: 'extra_id',
  comicVolume: 'volume_id',
  comicChapter: 'chapter_id',
  novelVolume: 'volume_id',
} as const
export function activityWhere(db: LibraryDatabase, query: ActivityStatsQuery, sensitive: boolean) {
  const works = workSet(db, query.scope, sensitive)
  const filter = query.context
  let owner: string | undefined, medium: WorkType | undefined, extra: SQL | undefined
  if (filter?.type === 'work') {
    requireEntry(db, filter.work)
    owner = filter.work.id
    medium = filter.work.type
  } else if (filter?.type === 'launchConfig') {
    if (
      !db.get(
        sql`select 1 from game_launch_configs where game_id=${filter.gameId} and id=${filter.launchConfigId}`,
      )
    ) {
      throw new DesktopError('InvalidReference', 'Unknown game launch configuration')
    }
    owner = filter.gameId
    medium = 'game'
    extra = sql`a.launch_config_id=${filter.launchConfigId}`
  } else if (filter?.type === 'part') {
    const part = requirePart(db, filter.part)
    owner = part.work.id
    medium = part.work.type
    extra = sql`a.${sql.identifier(partContext[part.ref.type])}=${part.ref.id}`
  } else if (filter?.type === 'file') {
    owner = filter.work.id
    medium = filter.work.type
    if (
      !db.get(
        sql`select 1 from ${sql.identifier(medium + '_files')} where id=${filter.fileId} and ${sql.identifier(medium + '_id')}=${owner}`,
      )
    ) {
      throw new DesktopError('InvalidReference', 'Unknown file for this work')
    }
    extra = sql`a.file_id=${filter.fileId}`
  }
  const queries = workTypes
    .filter((type) => !medium || medium === type)
    .map((type) => {
      const [table, column] = sources[type],
        id = sql`a.${sql.identifier(column)}`
      const conditions: SQL[] = [sql`${id} in (select id from scope)`]
      if (owner) {
        conditions.push(sql`${id}=${owner}`)
      }
      if (extra) {
        conditions.push(extra)
      }
      if (query.range) {
        conditions.push(sql`a.started_at<${query.range.to} and a.ended_at>${query.range.from}`)
      }
      let part = sql`null`,
        kind = sql`null`
      if (type === 'anime') {
        part = sql`coalesce(a.episode_id,a.extra_id)`
        kind = sql`case when a.episode_id is not null then 'animeEpisode' else 'animeExtra' end`
      }
      if (type === 'comic') {
        part = sql`coalesce(a.volume_id,a.chapter_id)`
        kind = sql`case when a.volume_id is not null then 'comicVolume' else 'comicChapter' end`
      }
      if (type === 'novel') {
        part = sql`a.volume_id`
        kind = sql`'novelVolume'`
      }
      return sql`select a.id,${type} type,${id} workId,a.started_at startedAt,a.ended_at endedAt,a.duration_ms durationMs,a.context_names names,
    ${type !== 'game' ? sql`a.file_id` : sql`null`} fileId,${type === 'game' ? sql`a.launch_config_id` : sql`null`} configId,${part} partId,${kind} partType
    from ${sql.identifier(table)} a where ${sql.join(conditions, sql` and `)}`
    })
  return {
    scope: works,
    cte: sql`with scope as (${works}), events as (${sql.join(queries, sql` union all `)})`,
  }
}
