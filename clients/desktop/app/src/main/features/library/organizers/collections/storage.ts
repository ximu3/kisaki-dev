import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { and, asc, count, desc, eq, max, sql } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  type CollectionCreate,
  type CollectionUpdate,
  type CollectionQuery,
  type DynamicRules,
  type Collection,
  type QueryReferenceLabel,
  type MoveInput,
  type ReorderInput,
} from '@kisaki3/desktop-contracts/library'
import type { ListOptions } from '@kisaki3/desktop-contracts/operations'
import type { Attachment } from '@kisaki3/desktop-contracts/attachments'
import type { Storage } from '../../../../infrastructure/database'
import { ready } from '../../../../infrastructure/database/codecs/json'
import { collections, collectionMembers } from '../../../../infrastructure/database/schema'
import { adoptAttachments } from '../../../../infrastructure/attachments/storage'
import { searchText } from '../../../../infrastructure/database/search-text'
import { commit, expectFields, type LibraryDatabase } from '../../transaction'
import { requireEntry } from '../../entries/tables'
import { queryReferences } from '../../entries/query/references'
import { selectEntries } from '../../entries/query/read'
import { checkImages, imageIds } from '../../attachments'
import { storeDescription } from '../description'
import { orderedIds } from '../../ordering'

function adoptRules(
  db: LibraryDatabase,
  rules: DynamicRules,
  sensitive: boolean,
  previous: readonly QueryReferenceLabel[] = [],
) {
  return ready({
    ...rules,
    referenceLabels: queryReferences(
      db,
      { scope: { type: 'library' }, rules: rules.rules },
      sensitive,
      previous,
    ),
  })
}

function collectionValue(row: typeof collections.$inferSelect): Collection {
  if (row.membershipMode === 'manual') {
    return { ...row, membershipMode: 'manual', dynamicRules: null }
  }
  if (row.dynamicRules === null) {
    throw new DesktopError('DataIntegrityError', 'A dynamic collection has no rules')
  }
  return { ...row, membershipMode: 'dynamic', dynamicRules: row.dynamicRules }
}

export function collectionStorage(storage: Storage) {
  return {
    listLibraryCollections(query: CollectionQuery, options: ListOptions, sensitive: boolean) {
      return storage.transaction((db) => {
        const terms = searchText(query.search).trim().split(/\s+/u).filter(Boolean)
        const where = and(
          sensitive ? undefined : eq(collections.isNsfw, false),
          query.membershipMode ? eq(collections.membershipMode, query.membershipMode) : undefined,
          ...terms.map(
            (word) =>
              sql`(instr(library_text(${collections.name}),${word}) or instr(library_markdown(${collections.description}),${word}))`,
          ),
        )
        const order =
          query.sort.type === 'scope'
            ? collections.sortOrder
            : (query.sort.direction === 'asc' ? asc : desc)(
                query.sort.field === 'name'
                  ? sql`${collections.name} collate kisaki_name`
                  : collections[query.sort.field],
              )
        return {
          items: db
            .select({
              id: collections.id,
              name: collections.name,
              isNsfw: collections.isNsfw,
              primaryImageId: collections.primaryImageId,
              membershipMode: collections.membershipMode,
            })
            .from(collections)
            .where(where)
            .orderBy(order, collections.id)
            .limit(options.limit)
            .offset(options.offset)
            .all(),
          total: db.select({ n: count() }).from(collections).where(where).get()!.n,
        }
      })
    },
    readLibraryCollection(id: string, sensitive: boolean) {
      const row = storage.db
        .select()
        .from(collections)
        .where(and(eq(collections.id, id), sensitive ? undefined : eq(collections.isNsfw, false)))
        .get()
      return row ? collectionValue(row) : null
    },
    addLibraryCollection(
      input: CollectionCreate,
      images: readonly Attachment[],
      sensitive: boolean,
    ) {
      return commit(storage, (write) => {
        const { db, now } = write
        const id = randomUUID()
        adoptAttachments(db, images)
        checkImages(db, imageIds(input))
        const last =
          db
            .select({ n: max(collections.sortOrder) })
            .from(collections)
            .get()!.n ?? -1
        db.insert(collections)
          .values({
            id,
            name: input.name,
            description: input.description ?? null,
            isNsfw: input.isNsfw ?? false,
            primaryImageId: input.primaryImageId ?? null,
            membershipMode: input.membershipMode ?? 'manual',
            dynamicRules:
              input.membershipMode === 'dynamic'
                ? adoptRules(db, input.dynamicRules, sensitive)
                : null,
            sortOrder: last + 1,
            createdAt: now,
            updatedAt: now,
          })
          .run()
        storeDescription(write, 'collection', id, input.description ?? null)
        write.changes.push({ type: 'collectionCreated', collectionId: id })
        if (input.membershipMode !== 'dynamic' && input.members?.length) {
          input.members.forEach((member, index) => {
            requireEntry(db, member.entry)
            db.insert(collectionMembers)
              .values({
                collectionId: id,
                entryId: member.entry.id,
                note: member.note ?? null,
                orderInCollection: index,
              })
              .run()
          })
          write.changes.push({
            type: 'collectionMembersChanged',
            collectionId: id,
            entries: input.members.map((row) => row.entry),
          })
        }
        return id
      })
    },
    editLibraryCollection(
      id: string,
      input: CollectionUpdate,
      images: readonly Attachment[],
      sensitive: boolean,
    ) {
      return commit(storage, (write) => {
        const { db, now } = write
        const row = db.select().from(collections).where(eq(collections.id, id)).get()
        if (!row) {
          throw new DesktopError('NotFound', 'The collection does not exist')
        }
        const previous = row.dynamicRules?.status === 'ready' ? row.dynamicRules.value : undefined
        expectFields({ ...row, dynamicRules: previous }, input.expected)
        const { dynamicRules, ...fields } = input.changes
        if (dynamicRules && row.membershipMode !== 'dynamic') {
          throw new DesktopError('InvalidInput', 'A manual collection does not use matching rules')
        }
        const rules = dynamicRules
          ? adoptRules(db, dynamicRules, sensitive, previous?.referenceLabels)
          : row.dynamicRules

        if (
          Object.entries(fields).every(([key, value]) =>
            isDeepStrictEqual(value, Reflect.get(row, key)),
          ) &&
          isDeepStrictEqual(rules, row.dynamicRules)
        ) {
          return
        }
        adoptAttachments(db, images)
        checkImages(db, imageIds(fields))
        if (fields.description !== undefined) {
          storeDescription(write, 'collection', id, fields.description)
        }
        if (
          fields.primaryImageId !== undefined &&
          fields.primaryImageId !== row.primaryImageId &&
          row.primaryImageId
        ) {
          write.released.add(row.primaryImageId)
        }
        db.update(collections)
          .set({ ...fields, ...(dynamicRules && { dynamicRules: rules }), updatedAt: now })
          .where(eq(collections.id, id))
          .run()
        write.changes.push({ type: 'collectionUpdated', collectionId: id })
      })
    },
    manualizeCollection(id: string, expected: DynamicRules) {
      return commit(storage, (write) => {
        const { db } = write
        const row = db.select().from(collections).where(eq(collections.id, id)).get()
        if (
          row?.membershipMode !== 'dynamic' ||
          row.dynamicRules?.status !== 'ready' ||
          !isDeepStrictEqual(expected, row.dynamicRules.value)
        ) {
          throw new DesktopError('Conflict', 'The collection rules changed')
        }
        const { rules, search, sort } = row.dynamicRules.value
        const members = selectEntries(
          db,
          { rules, search, sort, scope: { type: 'library' } },
          { type: 'all' },
          { sensitive: true, spoilers: true },
        )
        db.update(collections)
          .set({ membershipMode: 'manual', dynamicRules: null, updatedAt: write.now })
          .where(eq(collections.id, id))
          .run()
        for (const [order, entry] of members.entries()) {
          db.insert(collectionMembers)
            .values({ entryId: entry.id, collectionId: id, orderInCollection: order })
            .run()
        }
        write.changes.push(
          { type: 'collectionUpdated', collectionId: id },
          { type: 'collectionMembersChanged', collectionId: id, entries: members },
        )
      })
    },

    orderCollections: (input: ReorderInput | MoveInput) =>
      commit(storage, (write) => {
        const rows = write.db
            .select({ id: collections.id })
            .from(collections)
            .orderBy(collections.sortOrder, collections.id)
            .all(),
          before = rows.map((row) => row.id)
        orderedIds(before, input).forEach((id, i) => {
          if (before[i] !== id) {
            write.db.update(collections).set({ sortOrder: i }).where(eq(collections.id, id)).run()
            write.changes.push({ type: 'collectionUpdated', collectionId: id })
          }
        })
      }),
  }
}
