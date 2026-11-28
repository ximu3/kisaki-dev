import { sql, type SQL } from 'drizzle-orm'
import {
  entryFieldTypes,
  type EntryProjectionField,
  type EntrySortField,
  type EntryType,
  type PartCountScope,
  type PartCountMeasure,
} from '@kisaki3/desktop-contracts/library'
import { localDate } from './dates'

const typeTables = {
  game: 'games',
  anime: 'animes',
  comic: 'comics',
  novel: 'novels',
  character: 'characters',
  person: 'persons',
  organization: 'organizations',
} as const
const activities = {
  game: 'game_play_activity',
  anime: 'anime_watch_activity',
  comic: 'comic_reading_activity',
  novel: 'novel_reading_activity',
} as const
const partTables = {
  animeEpisode: [
    'anime',
    'anime_episodes',
    'anime_episode_records',
    'anime_file_episodes',
    'episode_id',
  ],
  animeExtra: ['anime', 'anime_extras', 'anime_extra_records', 'anime_file_extras', 'extra_id'],
  comicVolume: [
    'comic',
    'comic_volumes',
    'comic_volume_records',
    'comic_file_volumes',
    'volume_id',
  ],
  comicChapter: [
    'comic',
    'comic_chapters',
    'comic_chapter_records',
    'comic_file_chapters',
    'chapter_id',
  ],
  novelVolume: [
    'novel',
    'novel_volumes',
    'novel_volume_records',
    'novel_file_volumes',
    'volume_id',
  ],
} as const
export const column = (name: string) =>
  sql.identifier(name.replace(/[A-Z]/gu, (letter) => '_' + letter.toLowerCase()))

export function oneOf(value: SQL, items: readonly unknown[]) {
  return sql`exists(select 1 from json_each(${JSON.stringify(items)}) options where options.value is ${value})`
}

export function partCount(scope: PartCountScope, measure: PartCountMeasure) {
  const [work, parts, records, links, id] = partTables[scope.partType]
  const tests = [sql`p.${column(work + 'Id')}=e.id`]
  if ('classification' in scope && scope.classification) {
    const included = oneOf(sql`p.type`, scope.classification.values)
    tests.push(scope.classification.op === 'in' ? included : sql`not ${included}`)
  }
  if (measure === 'completed') {
    tests.push(
      sql`exists(select 1 from ${sql.identifier(records)} r where r.${sql.identifier(id)}=p.id and r.is_completed=1)`,
    )
  }
  if (measure === 'withFiles' || measure === 'accessible') {
    const join =
      measure === 'accessible'
        ? sql`join ${sql.identifier(work + '_files')} f on f.id=l.file_id and json_extract(f.availability,'$.status')='accessible'`
        : sql.empty()
    tests.push(
      sql`exists(select 1 from ${sql.identifier(links)} l ${join} where l.${sql.identifier(id)}=p.id)`,
    )
  }
  return sql`(select count(*) from ${sql.identifier(parts)} p where ${sql.join(tests, sql` and `)})`
}

function choose(types: readonly EntryType[], read: (type: EntryType) => SQL): SQL {
  if (types.length === 1) {
    return read(types[0]!)
  }
  return sql`(case e.type ${sql.join(
    types.map((type) => sql`when ${type} then ${read(type)}`),
    sql` `,
  )} end)`
}

type Field =
  | EntryProjectionField
  | EntrySortField
  | 'aliases'
  | 'externalLinks'
  | 'description'
  | 'hasNotes'
  | 'hasBackdrop'
  | 'hasTitleLogo'
  | 'hasIcon'
  | 'hasPrimaryImage'
export function scalar(field: Exclude<Field, 'partCounts'>): SQL {
  switch (field) {
    case 'name':
    case 'originalName':
    case 'sortName':
    case 'effectiveSortName':
    case 'aliases':
    case 'description':
    case 'primaryImageId':
    case 'externalLinks':
    case 'isNsfw':
    case 'createdAt':
    case 'updatedAt':
    case 'addedDate':
      return sql`e.${column(field)}`
    case 'effectiveAddedDate':
      return sql`coalesce(e.added_date,${localDate(sql`e.created_at`)})`
    case 'hasNotes':
      return sql`exists(select 1 from note_entry_links n where n.entry_id=e.id)`
    case 'hasPrimaryImage':
      return sql`(e.primary_image_id is not null)`
    case 'favorite':
      return sql`coalesce((select favorite from entry_evaluations where entry_id=e.id),0)`
    case 'rating':
      return sql`(select rating from entry_evaluations where entry_id=e.id)`
    case 'status':
    case 'additionalCompletionCount':
    case 'additionalDurationMs': {
      const result = choose(
        entryFieldTypes[field],
        (type) =>
          sql`(select ${column(field)} from ${sql.identifier(type + '_records')} where ${column(type + 'Id')}=e.id)`,
      )
      return field === 'status' ? result : sql`coalesce(${result},0)`
    }
    case 'lastActiveAt':
    case 'totalDurationMs': {
      const rows = Object.entries(activities).map(
        ([type, table]) =>
          sql`when ${type} then (select ${field === 'lastActiveAt' ? sql`max(ended_at)` : sql`sum(duration_ms)`} from ${sql.identifier(table)} where ${column(type + 'Id')}=e.id)`,
      )
      const value = sql`(case e.type ${sql.join(rows, sql` `)} end)`
      return field === 'lastActiveAt'
        ? value
        : sql`(coalesce(${value},0)+${scalar('additionalDurationMs')})`
    }
    case 'completionCount':
      return sql`((select count(*) from work_completion_records where work_id=e.id)+${scalar('additionalCompletionCount')})`
    case 'firstCompletedDate':
    case 'lastCompletedDate': {
      const direction = field === 'firstCompletedDate' ? sql`asc` : sql`desc`
      return sql`(select completed_date from work_completion_records where work_id=e.id and completed_date is not null order by json_extract(completed_date,'$.year') ${direction},json_extract(completed_date,'$.month') ${direction},json_extract(completed_date,'$.day') ${direction} limit 1)`
    }
    case 'registeredFileCount':
    case 'accessibleFileCount':
    case 'uncheckedFileCount': {
      const state = field === 'accessibleFileCount' ? 'accessible' : 'unchecked'
      const filter =
        field === 'registeredFileCount'
          ? sql.empty()
          : sql`and json_extract(availability,'$.status')=${state}`
      return choose(
        entryFieldTypes[field],
        (type) =>
          sql`(select count(*) from ${sql.identifier(type + '_files')} where ${column(type + 'Id')}=e.id ${filter})`,
      )
    }
    case 'hasBackdrop':
    case 'hasTitleLogo':
    case 'hasIcon': {
      const key = {
        hasBackdrop: 'backdropImageId',
        hasTitleLogo: 'titleLogoId',
        hasIcon: 'iconImageId',
      }[field]
      return choose(
        entryFieldTypes[field],
        (type) =>
          sql`(select ${column(key)} is not null from ${sql.identifier(typeTables[type])} where entry_id=e.id)`,
      )
    }
    case 'birthMonthDay':
      return scalar('birthDate')
    case 'age':
    case 'birthDate':
    case 'bloodType':
    case 'bust':
    case 'cupSize':
    case 'deathDate':
    case 'declaredChapterCount':
    case 'declaredDurationMs':
    case 'declaredPageCount':
    case 'declaredRegularEpisodeCount':
    case 'declaredSpecialEpisodeCount':
    case 'declaredVolumeCount':
    case 'dissolvedDate':
    case 'foundedDate':
    case 'gender':
    case 'height':
    case 'hips':
    case 'originalLanguages':
    case 'releaseDate':
    case 'releaseEndDate':
    case 'releaseStatus':
    case 'waist':
    case 'weight':
      return choose(
        entryFieldTypes[field],
        (type) =>
          sql`(select ${column(field)} from ${sql.identifier(typeTables[type])} where entry_id=e.id)`,
      )
  }
}
