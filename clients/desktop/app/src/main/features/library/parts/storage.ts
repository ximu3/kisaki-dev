import { and, count, eq, sql } from 'drizzle-orm'
import type { PartCreate, PartUpdate, PartQuery, PartRef } from '@kisaki3/desktop-contracts/library'
import type { Attachment } from '@kisaki3/desktop-contracts/attachments'
import type { ListOptions } from '@kisaki3/desktop-contracts/operations'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { Storage } from '../../../infrastructure/database'
import { adoptAttachments } from '../../../infrastructure/attachments/storage'
import { entries } from '../../../infrastructure/database/schema'
import { searchText } from '../../../infrastructure/database/search-text'
import { entryWhere } from '../entries/tables'
import { commit } from '../transaction'
import { parts } from './tables'
import { correctAnimeKind, mergeParts, removePart } from './identity'
import { volumeMembers, editVolumeMembers, orderParts } from './members'
import type {
  PartKindChange,
  VolumeChapterChange,
  VolumeChapter,
  PartOrderScope,
  MoveInput,
  ReorderInput,
} from '@kisaki3/desktop-contracts/library'
import { changePart, insertPart, getPart, completePart } from './write'

import { volumeChapterStorage } from './members'

import { partDependents, verifyDependents, type PartDependents } from './identity'
export function partStorage(storage: Storage) {
  return {
    ...volumeChapterStorage(storage),
    listLibraryParts(input: PartQuery, range: ListOptions, sensitive: boolean) {
      return storage.transaction((db) => {
        if (
          !db
            .select({ id: entries.id })
            .from(entries)
            .where(and(entryWhere(input.work), sensitive ? undefined : eq(entries.isNsfw, false)))
            .get()
        ) {
          throw new DesktopError('NotFound', 'The work is unavailable')
        }
        const { table, owner, record } = parts[input.partType]
        const filters = [eq(owner, input.work.id)]
        if (input.completed !== undefined) {
          filters.push(
            sql`coalesce((select ${record.isCompleted} from ${record} where ${record.partId}=${table.id}),0)=${Number(input.completed)}`,
          )
        }
        if ('classifications' in input && input.classifications) {
          filters.push(
            sql`exists(select 1 from json_each(${JSON.stringify(input.classifications)}) where value is ${table}."type")`,
          )
        }
        for (const word of searchText(input.search).trim().split(/\s+/u).filter(Boolean)) {
          const number =
            input.partType === 'animeExtra'
              ? sql.empty()
              : sql`or instr(library_text(${table}."number_label"),${word})`
          filters.push(
            sql`(instr(library_text(${table.name}),${word}) or instr(library_text(${table.originalName}),${word}) or instr(library_markdown(${table.description}),${word}) or exists(select 1 from json_each(${table.aliases}) a where instr(library_text(a.value),${word})) ${number})`,
          )
        }
        const where = and(...filters)
        const rows = db
          .select({ id: table.id })
          .from(table)
          .where(where)
          .orderBy(table.sortOrder, table.id)
          .limit(range.limit)
          .offset(range.offset)
          .all()
        return {
          total: db.select({ n: count() }).from(table).where(where).get()!.n,
          items: rows.map(({ id }) => getPart(db, { type: input.partType, id })!),
        }
      })
    },
    readLibraryPart(ref: PartRef, sensitive: boolean) {
      return storage.transaction((db) => {
        const part = getPart(db, ref)
        return part &&
          (sensitive ||
            db
              .select({ id: entries.id })
              .from(entries)
              .where(and(entryWhere(part.work), eq(entries.isNsfw, false)))
              .get())
          ? part
          : null
      })
    },
    addLibraryPart: (input: PartCreate, images: readonly Attachment[]) =>
      commit(storage, (write) => {
        adoptAttachments(write.db, images)
        return insertPart(write, input)
      }),
    editLibraryPart: (input: PartUpdate, images: readonly Attachment[]) =>
      commit(storage, (write) => {
        adoptAttachments(write.db, images)
        changePart(write, input)
      }),
    completeLibraryParts: (refs: readonly PartRef[], done: boolean) =>
      commit(storage, (write) => {
        for (const part of refs) {
          completePart(write, part, done)
        }
      }),
    partDependents: (refs: readonly PartRef[]) =>
      storage.transaction((db) => partDependents(db, refs)),
    changeLibraryPartKind: (
      ref: PartRef<'animeEpisode' | 'animeExtra'>,
      input: PartKindChange,
      images: readonly Attachment[],
      baseline: PartDependents,
    ) =>
      commit(storage, (write) => {
        adoptAttachments(write.db, images)
        verifyDependents(write.db, baseline)
        return correctAnimeKind(write, ref, input)
      }),
    mergeLibraryParts: (source: PartRef, target: PartRef, baseline: PartDependents) =>
      commit(storage, (write) => {
        verifyDependents(write.db, baseline)
        return mergeParts(write, source, target)
      }),
    deleteLibraryParts: (refs: readonly PartRef[], baseline: PartDependents) =>
      commit(storage, (write) => {
        verifyDependents(write.db, baseline)
        for (const ref of refs) {
          removePart(write, ref)
        }
      }),
    orderLibraryParts: (scope: PartOrderScope, input: MoveInput | ReorderInput) =>
      commit(storage, (write) => orderParts(write, scope, input)),
    readVolumeMembers: (volume: PartRef<'comicVolume'>, range: ListOptions) =>
      storage.transaction((db) => volumeMembers(db, volume, range)),
    editVolumeMembers: (
      volume: PartRef<'comicVolume'>,
      change: VolumeChapterChange,
      expected?: readonly VolumeChapter[],
    ) => commit(storage, (write) => editVolumeMembers(write, volume, change, expected)),
  }
}
