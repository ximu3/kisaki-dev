import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseActivityContextNames,
  workTypes,
  type Activity,
  type ActivityCreate,
  type ActivityStatistics,
  type ActivityUpdate,
  type PartRef,
  type WorkRef,
  type WorkType,
} from '@kisaki3/desktop-contracts/library'
import type { ListOptions } from '@kisaki3/desktop-contracts/operations'
import { and, eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import type { Storage } from '../../../../infrastructure/database'
import { readStoredValue, ready } from '../../../../infrastructure/database/codecs/json'
import {
  animeWatchActivity,
  comicReadingActivity,
  entries,
  gameLaunchConfigs,
  gamePlayActivity,
  novelReadingActivity,
} from '../../../../infrastructure/database/schema'
import { entryWhere, requireEntry } from '../../entries/tables'
import { requirePart } from '../../parts/write'
import { commit, type LibraryDatabase, type LibraryWrite } from '../../transaction'
import { activityWhere, type ActivityStatsQuery } from './query'
import { summarize } from './statistics'
import { activityTables } from './tables'

type RawRow = {
  id: string
  type: WorkType
  workId: string
  startedAt: bigint
  endedAt: bigint
  durationMs: bigint
  names: string
  configId: string | null
  fileId: string | null
  partId: string | null
  partType: PartRef['type'] | null
}

function activity(row: RawRow): Activity {
  const contextNames = readStoredValue(row.names, parseActivityContextNames)
  if (contextNames.status === 'invalid') {
    throw new DesktopError('DataIntegrityError', 'The activity context snapshot is invalid')
  }
  const part = row.partId && row.partType ? { type: row.partType, id: row.partId } : null
  return {
    id: row.id,
    work: { type: row.type, id: row.workId },
    startedAt: Number(row.startedAt),
    endedAt: Number(row.endedAt),
    durationMs: Number(row.durationMs),
    contextNames: contextNames.value,
    context: row.type === 'game' ? { launchConfigId: row.configId } : { fileId: row.fileId, part },
  } as Activity
}

function current(db: LibraryDatabase, work: WorkRef, id: string, sensitive: boolean) {
  const { cte } = activityWhere(db, { scope: { type: 'works', refs: [work] } }, sensitive)
  const row = db.get<RawRow>(sql`${cte} select * from events where id=${id} and type=${work.type}`)
  return row ? activity(row) : null
}

function add(write: LibraryWrite, input: ActivityCreate) {
  requireEntry(write.db, input.work)
  const { work, startedAt, endedAt, durationMs } = input
  const id = randomUUID()
  const names: { fileName?: string; partName?: string; launchConfigName?: string } = {}
  const context = input.context
  let launchConfigId: string | null = null,
    fileId: string | null = null,
    part: PartRef | null = null
  if (context && 'launchConfigId' in context && context.launchConfigId) {
    launchConfigId = context.launchConfigId
    const config = write.db
      .select({ name: gameLaunchConfigs.name })
      .from(gameLaunchConfigs)
      .where(and(eq(gameLaunchConfigs.id, launchConfigId), eq(gameLaunchConfigs.gameId, work.id)))
      .get()
    if (!config) {
      throw new DesktopError(
        'InvalidReference',
        'The launch configuration does not belong to this game',
      )
    }
    names.launchConfigName = config.name
  }
  if (context && 'fileId' in context) {
    fileId = context.fileId
    part = context.part
    if (fileId) {
      const row = write.db.get<{ path: string }>(
        sql`select path from ${sql.identifier(work.type + '_files')} where id=${fileId} and ${sql.identifier(work.type + '_id')}=${work.id}`,
      )
      if (!row) {
        throw new DesktopError('InvalidReference', 'The file does not belong to this work')
      }
      names.fileName = basename(row.path)
    }
    if (part) {
      const item = requirePart(write.db, part)
      if (item.work.id !== work.id) {
        throw new DesktopError('InvalidReference', 'The part belongs to a different work')
      }
      const title = item.data.name ?? ('numberLabel' in item.data ? item.data.numberLabel : null)
      if (title) {
        names.partName = title
      }
    }
  }
  const values = { id, startedAt, endedAt, durationMs, contextNames: ready(names) }
  switch (work.type) {
    case 'game':
      write.db
        .insert(gamePlayActivity)
        .values({ ...values, gameId: work.id, launchConfigId })
        .run()
      break
    case 'anime':
      write.db
        .insert(animeWatchActivity)
        .values({
          ...values,
          animeId: work.id,
          fileId,
          episodeId: part?.type === 'animeEpisode' ? part.id : null,
          extraId: part?.type === 'animeExtra' ? part.id : null,
        })
        .run()
      break
    case 'comic':
      write.db
        .insert(comicReadingActivity)
        .values({
          ...values,
          comicId: work.id,
          fileId,
          volumeId: part?.type === 'comicVolume' ? part.id : null,
          chapterId: part?.type === 'comicChapter' ? part.id : null,
        })
        .run()
      break
    case 'novel':
      write.db
        .insert(novelReadingActivity)
        .values({ ...values, novelId: work.id, fileId, volumeId: part?.id ?? null })
        .run()
      break
  }
  write.changes.push({ type: 'activityCreated', work, activityId: id })
  return id
}

export function activityStorage(storage: Storage) {
  return {
    addActivity: (input: ActivityCreate) => commit(storage, (write) => add(write, input)),
    readActivity(work: WorkRef, id: string, sensitive: boolean) {
      return storage.transaction((db) =>
        db.select({ id: entries.id }).from(entries).where(entryWhere(work)).get()
          ? current(db, work, id, sensitive)
          : null,
      )
    },
    listActivities(query: ActivityStatsQuery, range: ListOptions, sensitive: boolean) {
      return storage.transaction((db) => {
        const { cte } = activityWhere(db, query, sensitive)
        const rows = db.all<RawRow>(
          sql`${cte} select * from events order by startedAt desc,type,id limit ${range.limit} offset ${range.offset}`,
        )
        return {
          items: rows.map(activity),
          total: Number(db.get<{ n: bigint }>(sql`${cte} select count(*) n from events`)!.n),
        }
      })
    },
    editActivity(work: WorkRef, id: string, input: ActivityUpdate) {
      return commit(storage, (write) => {
        const previous = current(write.db, work, id, true)
        if (!previous) {
          throw new DesktopError('NotFound', 'The activity no longer exists')
        }
        const before = {
          startedAt: previous.startedAt,
          endedAt: previous.endedAt,
          durationMs: previous.durationMs,
        }
        if (
          input.expected &&
          !isDeepStrictEqual(input.expected.activity, { ...before, context: previous.context })
        ) {
          throw new DesktopError('Conflict', 'The activity was changed')
        }
        if (isDeepStrictEqual(input.changes, before)) {
          return
        }
        const { table } = activityTables[work.type]
        write.db.update(table).set(input.changes).where(eq(table.id, id)).run()
        write.changes.push({ type: 'activityUpdated', work, activityId: id })
      })
    },
    deleteActivities(work: WorkRef, ids: readonly string[]) {
      return commit(storage, (write) => {
        const { table, owner } = activityTables[work.type]
        for (const id of ids) {
          if (
            !write.db
              .delete(table)
              .where(and(eq(table.id, id), eq(owner, work.id)))
              .run().changes
          ) {
            throw new DesktopError(
              'NotFound',
              'The selected activity no longer belongs to this work',
            )
          }
          write.changes.push({ type: 'activityDeleted', work, activityId: id })
        }
      })
    },
    summarizeActivities(query: ActivityStatsQuery, sensitive: boolean): ActivityStatistics {
      return storage.transaction((db) => {
        const { cte, scope } = activityWhere(db, query, sensitive)
        const rows = db.all<
          Pick<RawRow, 'type' | 'workId' | 'startedAt' | 'endedAt' | 'durationMs'>
        >(sql`${cte} select type,workId,startedAt,endedAt,durationMs from events`)
        const additions: { type: WorkType; workId: string; durationMs: bigint }[] = []
        if (!query.range && (!query.context || query.context.type === 'work')) {
          const owner = query.context?.work.id
          const pieces = workTypes.map(
            (type) =>
              sql`select ${type} type,${sql.identifier(type + '_id')} workId,additional_duration_ms durationMs from ${sql.identifier(type + '_records')} where additional_duration_ms>0`,
          )
          additions.push(
            ...db.all<(typeof additions)[number]>(
              sql`with scope as (${scope}) select a.* from (${sql.join(pieces, sql` union all `)}) a join scope s on s.id=a.workId ${owner ? sql`where a.workId=${owner}` : sql.empty()}`,
            ),
          )
        }
        return summarize(rows, additions, query)
      })
    },
  }
}
