import { sql, type SQL } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  entryFieldTypes,
  entryLocateOffset,
  parseEntryListItem,
  type EntryProjectionField,
  type EntryListOptions,
  type EntryLocateOptions,
  type EntryQuery,
  type EntryRef,
  type EntryGroupKey,
  type EntryGroupResult,
  type EntrySelection,
  type PartCountScope,
  type PartCountMeasure,
} from '@kisaki3/desktop-contracts/library'
import type { LibraryDatabase } from '../../transaction'
import { makeQuery } from './scope'
import { partCount, scalar } from './fields'
import type { Visibility } from './relations'

const jsonFields = new Set<EntryProjectionField>([
  'addedDate',
  'effectiveAddedDate',
  'releaseDate',
  'releaseEndDate',
  'birthDate',
  'deathDate',
  'foundedDate',
  'dissolvedDate',
  'firstCompletedDate',
  'lastCompletedDate',
  'originalLanguages',
  'age',
  'height',
  'weight',
  'bust',
  'waist',
  'hips',
  'partCounts',
])
const measures: readonly PartCountMeasure[] = ['registered', 'completed', 'withFiles', 'accessible']
function counts(scope: PartCountScope) {
  return sql`json_object(${sql.join(
    measures.flatMap((key) => [sql`${key}`, partCount(scope, key)]),
    sql`,`,
  )})`
}

function breakdown(kind: 'animeEpisode' | 'animeExtra') {
  const classifications =
    kind === 'animeEpisode'
      ? (['regular', 'special', null] as const)
      : (['opening', 'ending', 'promotion', 'interview', 'other', null] as const)
  const subtypes = classifications.flatMap((value) => {
    const scope = {
      partType: kind,
      classification: { op: 'in', values: [value] },
    } as PartCountScope
    return [sql`${value ?? 'unknown'}`, counts(scope)]
  })
  return sql`json_set(${counts({ partType: kind })},'$.byType',json_object(${sql.join(subtypes, sql`,`)}))`
}

function projection(field: EntryProjectionField) {
  if (field !== 'partCounts') {
    return scalar(field)
  }
  return sql`case e.type when 'anime' then json_object('animeEpisode',${breakdown('animeEpisode')},'animeExtra',${breakdown('animeExtra')})
    when 'comic' then json_object('comicVolume',${counts({ partType: 'comicVolume' })},'comicChapter',${counts({ partType: 'comicChapter' })})
    when 'novel' then json_object('novelVolume',${counts({ partType: 'novelVolume' })}) end`
}

type Resolved = ReturnType<ReturnType<typeof makeQuery>['resolve']>
type Row = EntryRef & { name: string } & Record<string, unknown>

function size(db: LibraryDatabase, where: SQL) {
  return Number(
    db.get<{ n: bigint | number }>(sql`select count(*) n from entries e where ${where}`)!.n,
  )
}

function interval(db: LibraryDatabase, query: Resolved, options: EntryListOptions) {
  const fields = options.fields ?? []
  const selected = fields.map((field) => sql`, ${projection(field)} as ${sql.identifier(field)}`)
  const rows = db.all<Row>(
    sql`select e.id,e.type,e.name ${sql.join(selected)} from entries e where ${query.where} order by ${query.order} limit ${options.limit} offset ${options.offset}`,
  )
  return rows.map((row) => {
    const item: Record<string, unknown> = { id: row.id, type: row.type, name: row.name }
    for (const field of fields) {
      if (!entryFieldTypes[field].includes(row.type)) {
        continue
      }
      let value = row[field]
      if (typeof value === 'bigint') {
        value = Number(value)
      }
      if (jsonFields.has(field) && typeof value === 'string') {
        try {
          value = JSON.parse(value) as unknown
        } catch {
          value = field === 'originalLanguages' ? [] : null
        }
      }
      if (field === 'isNsfw' || field === 'favorite') {
        value = !!value
      }
      item[field] = value
    }
    return parseEntryListItem(item, fields)
  })
}

export function readInterval(
  db: LibraryDatabase,
  input: EntryQuery,
  options: EntryListOptions,
  view: Visibility,
) {
  const query = makeQuery(db, input, view).resolve(options.group)
  return { total: size(db, query.where), items: interval(db, query, options) }
}

function position(db: LibraryDatabase, query: Resolved, target: EntryRef) {
  const row = db.get<{ i: bigint | number }>(
    sql`select i from (select e.id,e.type,row_number() over(order by ${query.order})-1 i from entries e where ${query.where}) where id=${target.id} and type=${target.type}`,
  )
  return row ? Number(row.i) : undefined
}

export function locate(
  db: LibraryDatabase,
  input: EntryQuery,
  target: EntryRef,
  options: EntryLocateOptions,
  view: Visibility,
) {
  const query = makeQuery(db, input, view).resolve(options.group)
  const index = position(db, query, target)
  if (index === undefined) {
    return null
  }
  const total = size(db, query.where)
  const offset = entryLocateOffset(index, total, options.limit)
  return { total, index, offset, items: interval(db, query, { ...options, offset }) }
}

export function groupCounts(db: LibraryDatabase, input: EntryQuery, view: Visibility) {
  const plan = makeQuery(db, input, view)
  const total = size(db, plan.resolve().where)
  const groups = plan.groups.map((key): EntryGroupResult => {
    try {
      return { status: 'ready', key, count: size(db, plan.resolve(key).where) }
    } catch (error) {
      if (
        !(error instanceof DesktopError) ||
        !['InvalidReference', 'InvalidQuery'].includes(error.code)
      ) {
        throw error
      }
      return { status: 'failed', key, error: { code: error.code, message: error.message } }
    }
  })
  return { total, groups }
}

export function locateInGroups(
  db: LibraryDatabase,
  input: EntryQuery,
  target: EntryRef,
  preferred: EntryGroupKey | undefined,
  view: Visibility,
) {
  const plan = makeQuery(db, input, view)
  const same = (a: EntryGroupKey, b: EntryGroupKey) =>
    a.type === b.type && (a.type !== 'collection' || (b.type === 'collection' && a.id === b.id))
  const first = preferred && plan.groups.find((key) => same(key, preferred))
  const order = first ? [first, ...plan.groups.filter((key) => !same(key, first))] : plan.groups
  for (const group of order) {
    let query: Resolved
    try {
      query = plan.resolve(group)
    } catch (cause) {
      if (
        cause instanceof DesktopError &&
        (cause.code === 'InvalidQuery' || cause.code === 'InvalidReference')
      ) {
        continue
      }
      throw cause
    }
    const hit = db.get(
      sql`select 1 from entries e where e.id=${target.id} and e.type=${target.type} and (${query.where})`,
    )
    if (hit) {
      return { group, index: position(db, query, target)! }
    }
  }
  return null
}

function refs(db: LibraryDatabase, query: Resolved, start = 0, length = -1) {
  return db.all<EntryRef>(
    sql`select e.id,e.type from entries e where ${query.where} order by ${query.order} limit ${length} offset ${start}`,
  )
}

export function selectEntries(
  db: LibraryDatabase,
  input: EntryQuery,
  request: EntrySelection,
  view: Visibility,
) {
  const plan = makeQuery(db, input, view)
  const missing = () => {
    throw new DesktopError(
      'SelectionChanged',
      'A selection endpoint no longer belongs to this view',
    )
  }
  function required(query: Resolved, ref: EntryRef) {
    return position(db, query, ref) ?? missing()
  }

  if (request.type === 'all') {
    return refs(db, plan.resolve())
  }
  if (request.type === 'range') {
    const query = plan.resolve()
    const a = required(query, request.anchor)
    const b = required(query, request.focus)
    return refs(db, query, Math.min(a, b), Math.abs(b - a) + 1)
  }
  const groupKey = (key: EntryGroupKey) => (key.type === 'unclassified' ? null : key.id)
  const expanded = new Set(request.expandedGroups.map(groupKey))
  const groups = plan.groups.filter((group) => expanded.has(groupKey(group)))
  const endpoints = [request.anchor, request.focus]
    .map(({ ref, group }) => {
      const segment = groups.findIndex((key) => groupKey(key) === groupKey(group))
      if (segment < 0) {
        missing()
      }
      return { segment, index: required(plan.resolve(group), ref) }
    })
    .sort((a, b) => a.segment - b.segment || a.index - b.index)
  const [first, last] = endpoints
  const result = new Map<string, EntryRef>()
  for (let i = first!.segment; i <= last!.segment; i++) {
    const query = plan.resolve(groups[i])
    const start = i === first!.segment ? first!.index : 0
    const limit = i === last!.segment ? last!.index - start + 1 : -1
    for (const ref of refs(db, query, start, limit)) {
      result.set(ref.id, ref)
    }
  }
  return [...result.values()]
}
