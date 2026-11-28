import { and, count, eq, sql, type SQL } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  workTypes,
  type Annotation,
  type AnnotationRef,
  type AnnotationQuery,
  type AnnotationSummary,
  type AnnotationPositionHint,
  type AnnotationLocationResult,
  type WorkRef,
  type FileWorkType,
} from '@kisaki3/desktop-contracts/library'
import type { ListOptions } from '@kisaki3/desktop-contracts/operations'
import * as s from '../../../../infrastructure/database/schema'
import { searchText } from '../../../../infrastructure/database/search-text'
import { readMarkdown } from '../../../../infrastructure/markdown'
import type { LibraryDatabase } from '../../transaction'
import { requireEntry } from '../../entries/tables'
import { fileRow } from '../../holdings/files/record'

export const tables = {
  game: {
    table: s.gameAnnotations,
    owner: s.gameAnnotations.gameId,
    images: s.gameAnnotationContentAttachments,
  },
  anime: {
    table: s.animeAnnotations,
    owner: s.animeAnnotations.animeId,
    images: s.animeAnnotationContentAttachments,
  },
  comic: {
    table: s.comicAnnotations,
    owner: s.comicAnnotations.comicId,
    images: s.comicAnnotationContentAttachments,
  },
  novel: {
    table: s.novelAnnotations,
    owner: s.novelAnnotations.novelId,
    images: s.novelAnnotationContentAttachments,
  },
}
export function annotationWork(annotation: Annotation): WorkRef {
  switch (annotation.workType) {
    case 'game':
      return { type: 'game', id: annotation.gameId }
    case 'anime':
      return { type: 'anime', id: annotation.animeId }
    case 'comic':
      return { type: 'comic', id: annotation.comicId }
    case 'novel':
      return { type: 'novel', id: annotation.novelId }
  }
}
export function readAnnotation(
  db: LibraryDatabase,
  ref: AnnotationRef,
  sensitive: boolean,
): Annotation | null {
  const { table, owner } = tables[ref.workType]
  const row = db
    .select()
    .from(table)
    .where(
      and(
        eq(table.id, ref.id),
        sensitive
          ? undefined
          : sql`exists(select 1 from entries where id=${owner} and not is_nsfw)`,
      ),
    )
    .get()
  if (!row) {
    return null
  }
  if ('location' in row) {
    if (row.location.status === 'invalid') {
      throw new DesktopError('DataIntegrityError', 'The saved annotation location is invalid')
    }
    return { ...row, workType: ref.workType, location: row.location.value } as Annotation
  }
  return { ...row, workType: 'game' }
}
function positionHint(a: Annotation): AnnotationPositionHint | null {
  if (a.workType === 'game') {
    return null
  }
  if (a.workType === 'anime') {
    const l = a.location
    return l.type === 'position'
      ? { type: 'video', startSeconds: l.positionSeconds, endSeconds: null }
      : { type: 'video', startSeconds: l.startSeconds, endSeconds: l.endSeconds }
  }
  const l = a.location
  if (l.type === 'region') {
    return { type: 'page', page: l.region.page }
  }
  if (l.type === 'position' && l.position.type === 'page') {
    return { type: 'page', page: l.position.page }
  }
  if (l.type === 'text' && l.selection.type === 'pages') {
    return { type: 'page', page: l.selection.pages[0].page }
  }
  return null
}
function summary(a: Annotation): AnnotationSummary {
  return {
    ref: { workType: a.workType, id: a.id },
    work: annotationWork(a),
    fileId: 'fileId' in a ? a.fileId : null,
    title: a.title,
    quoteExcerpt: 'quote' in a ? (a.quote?.slice(0, 160) ?? null) : null,
    contentExcerpt: readMarkdown(a.content).text.trim().slice(0, 160) || null,
    imageId: a.imageId,
    locationKind: a.workType === 'game' ? 'image' : a.location.type,
    positionHint: positionHint(a),
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  }
}
export function listAnnotations(
  db: LibraryDatabase,
  query: AnnotationQuery,
  range: ListOptions,
  sensitive: boolean,
) {
  const { scope } = query
  if (scope.type !== 'library') {
    requireEntry(db, scope.work)
  }
  if (scope.type === 'file') {
    fileRow(db, scope.work, scope.fileId)
  }
  const terms = searchText(query.search).trim().split(/\s+/u).filter(Boolean)
  const sources: SQL[] = []
  for (const type of query.workTypes ?? workTypes) {
    if (scope.type !== 'library' && scope.work.type !== type) {
      continue
    }
    const { table, owner } = tables[type]
    const conditions: SQL[] = []
    if (!sensitive) {
      conditions.push(sql`not e.is_nsfw`)
    }
    if (scope.type !== 'library') {
      conditions.push(sql`a.${sql.identifier(owner.name)}=${scope.work.id}`)
    }
    if (scope.type === 'file') {
      conditions.push(sql`a.file_id=${scope.fileId}`)
    }
    if (query.refs) {
      const ids = query.refs.filter((ref) => ref.workType === type).map((ref) => ref.id)
      if (!ids.length) {
        continue
      }
      conditions.push(sql`a.id in (select value from json_each(${JSON.stringify(ids)}))`)
    }
    const quote = type === 'comic' || type === 'novel' ? sql`a.quote` : sql`null`
    for (const term of terms) {
      conditions.push(
        sql`(instr(library_text(a.title),${term}) or instr(library_markdown(a.content),${term}) or instr(library_text(${quote}),${term}))`,
      )
    }
    sources.push(
      sql`select a.id,${type} workType,a.created_at created from ${table} a join entries e on e.id=a.${sql.identifier(owner.name)} where ${conditions.length ? sql.join(conditions, sql` and `) : sql`1`}`,
    )
  }
  if (!sources.length) {
    return { items: [], total: 0 }
  }
  const from = sql`from (${sql.join(sources, sql` union all `)})`
  const refs = db.all<AnnotationRef>(
    sql`select id,workType ${from} order by created desc,case workType when 'game' then 0 when 'anime' then 1 when 'comic' then 2 else 3 end,id limit ${range.limit} offset ${range.offset}`,
  )
  return {
    items: refs.map((ref) => summary(readAnnotation(db, ref, true)!)),
    total: Number(db.get<{ n: bigint }>(sql`select count(*) n ${from}`)!.n),
  }
}
export function locations(
  db: LibraryDatabase,
  work: WorkRef<FileWorkType>,
  fileId: string,
  range: ListOptions,
  sensitive: boolean,
): AnnotationLocationResult {
  fileRow(db, work, fileId)
  const { table, owner } = tables[work.type]
  const where = and(
    eq(owner, work.id),
    eq(table.fileId, fileId),
    sensitive ? undefined : sql`exists(select 1 from entries where id=${owner} and not is_nsfw)`,
  )
  const data = db
    .select({ id: table.id, location: table.location, createdAt: table.createdAt })
    .from(table)
    .where(where)
    .orderBy(table.createdAt, table.id)
    .limit(range.limit)
    .offset(range.offset)
    .all()
  return {
    items: data.map((row) => {
      if (row.location.status === 'invalid') {
        throw new DesktopError('DataIntegrityError', 'The saved annotation location is invalid')
      }
      return {
        ref: { id: row.id, workType: work.type },
        location: row.location.value,
        createdAt: row.createdAt,
      } as AnnotationLocationResult['items'][number]
    }),
    total: db.select({ n: count() }).from(table).where(where).get()!.n,
  }
}
