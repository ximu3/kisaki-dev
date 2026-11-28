import type { Attachment } from '@kisaki3/desktop-contracts/attachments'
import type {
  EntryCreate,
  EntryGroupKey,
  EntryListOptions,
  EntryLocateOptions,
  EntryQuery,
  EntryRef,
  EntrySelection,
  EntryUpdate,
  ExternalIdentity,
} from '@kisaki3/desktop-contracts/library'
import { and, eq, sql } from 'drizzle-orm'
import { adoptAttachments } from '../../../infrastructure/attachments/storage'
import type { Storage } from '../../../infrastructure/database'
import type { DatabaseCall } from '../../../infrastructure/database/executor'
import {
  collectionMembers,
  collections,
  entries,
  entryTags,
  tags,
} from '../../../infrastructure/database/schema'
import { commit } from '../transaction'
import { changeBinding, findIdentity } from './external-ids'
import { readDetails } from './query/details'
import { navigationStorage } from './query/locate-target'
import { groupCounts, locate, locateInGroups, readInterval, selectEntries } from './query/read'
import type { Visibility } from './query/relations'
import { entryWhere } from './tables'
import { createEntry, updateEntry } from './write'

export type EntryCall = DatabaseCall<ReturnType<typeof entryStorage>>

export function entryStorage(storage: Storage) {
  return {
    ...navigationStorage(storage),
    createLibraryEntry(input: EntryCreate, images: readonly Attachment[]) {
      return commit(storage, (write) => {
        adoptAttachments(write.db, images)
        return createEntry(write, input)
      })
    },
    editLibraryEntries(batch: readonly EntryUpdate[], images: readonly Attachment[]) {
      return commit(storage, (write) => {
        adoptAttachments(write.db, images)
        for (const edit of batch) {
          updateEntry(write, edit)
        }
      })
    },
    changeEntryBinding: (ref: EntryRef, identity: ExternalIdentity, bind: boolean) =>
      commit(storage, (write) => changeBinding(write, ref, identity, bind)),
    findLibraryIdentity(identity: ExternalIdentity, showSensitive: boolean) {
      return storage.transaction((db) => {
        const found = findIdentity(db, identity)
        if (!found || showSensitive) {
          return found
        }
        return (
          db
            .select({ type: entries.type, id: entries.id })
            .from(entries)
            .where(and(eq(entries.id, found.id), eq(entries.isNsfw, false)))
            .get() ?? null
        )
      })
    },
    resolveLibraryRefs(refs: readonly EntryRef[], showSensitive: boolean) {
      return storage.db
        .select({
          type: entries.type,
          id: entries.id,
          name: entries.name,
          primaryImageId: entries.primaryImageId,
        })
        .from(entries)
        .where(
          and(
            sql`${entries.id} in (select json_extract(value,'$.id') from json_each(${JSON.stringify(refs)}))`,
            showSensitive ? undefined : eq(entries.isNsfw, false),
          ),
        )
        .all()
        .filter((row) => refs.some((ref) => ref.id === row.id && ref.type === row.type))
    },
    readEntryOrganizers: (ref: EntryRef, sensitive: boolean, spoilers: boolean) =>
      storage.transaction((db) => {
        const shown = db
          .select({ id: entries.id })
          .from(entries)
          .where(and(entryWhere(ref), sensitive ? undefined : eq(entries.isNsfw, false)))
          .get()
        if (!shown) {
          return { tags: [], collections: [] }
        }
        const applied = db
          .select({
            id: tags.id,
            name: tags.name,
            note: entryTags.note,
            isSpoiler: entryTags.isSpoiler,
          })
          .from(entryTags)
          .innerJoin(tags, eq(tags.id, entryTags.tagId))
          .where(
            and(
              eq(entryTags.entryId, ref.id),
              sensitive ? undefined : eq(tags.isNsfw, false),
              spoilers ? undefined : eq(entryTags.isSpoiler, false),
            ),
          )
          .orderBy(entryTags.orderInEntry, tags.id)
          .all()
        const members = db
          .select({ id: collections.id, name: collections.name, note: collectionMembers.note })
          .from(collectionMembers)
          .innerJoin(collections, eq(collections.id, collectionMembers.collectionId))
          .where(
            and(
              eq(collectionMembers.entryId, ref.id),
              sensitive ? undefined : eq(collections.isNsfw, false),
            ),
          )
          .orderBy(collections.sortOrder, collections.id)
          .all()
        return { tags: applied, collections: members }
      }),
    readLibraryEntry: (ref: EntryRef, showSensitive: boolean) =>
      storage.transaction((db) => readDetails(db, ref, showSensitive)),
    readEntryDescription: (ref: EntryRef, showSensitive: boolean) =>
      storage.db
        .select({ value: entries.description })
        .from(entries)
        .where(and(entryWhere(ref), showSensitive ? undefined : eq(entries.isNsfw, false)))
        .get()?.value ?? null,
    readEntryInterval: (input: EntryQuery, options: EntryListOptions, view: Visibility) =>
      storage.transaction((db) => readInterval(db, input, options, view)),
    locateLibraryEntry: (
      input: EntryQuery,
      target: EntryRef,
      options: EntryLocateOptions,
      view: Visibility,
    ) => storage.transaction((db) => locate(db, input, target, options, view)),
    readEntryGroups: (query: EntryQuery, view: Visibility) =>
      storage.transaction((db) => groupCounts(db, query, view)),
    locateExplorerRow: (
      query: EntryQuery,
      ref: EntryRef,
      group: EntryGroupKey | undefined,
      view: Visibility,
    ) => storage.transaction((db) => locateInGroups(db, query, ref, group, view)),
    selectLibraryEntries: (query: EntryQuery, selection: EntrySelection, view: Visibility) =>
      storage.transaction((db) => selectEntries(db, query, selection, view)),
  }
}
