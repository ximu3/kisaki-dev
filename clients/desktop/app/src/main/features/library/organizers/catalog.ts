import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { and, asc, count, desc, eq, max, sql } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  tagNameKey,
  type CollectionCreate,
  type CollectionUpdate,
  type CollectionQuery,
  type TagCreate,
  type TagQuery,
  type TagUpdate,
  type DynamicRules,
  type Collection,
  type QueryReferenceLabel,
} from '@kisaki3/desktop-contracts/library'
import type { ListOptions } from '@kisaki3/desktop-contracts/operations'
import type { Attachment } from '@kisaki3/desktop-contracts/attachments'
import type { Storage } from '../../../infrastructure/database'
import { ready } from '../../../infrastructure/database/codecs/json'
import { collections, collectionMembers, tags } from '../../../infrastructure/database/schema'
import { adoptAttachments } from '../../../infrastructure/attachments/storage'
import { searchText } from '../../../infrastructure/database/search-text'
import { commit, expectFields, type LibraryDatabase, type LibraryWrite } from '../transaction'
import { requireEntry } from '../entries/tables'
import { queryReferences } from '../entries/query/references'
import { selectEntries } from '../entries/query/read'
import { checkImages, imageIds } from '../attachments'

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

function nameAvailable(db: LibraryDatabase, name: string, id?: string) {
  const key = tagNameKey(name)
  const existing = db.select({ id: tags.id }).from(tags).where(eq(tags.nameKey, key)).get()
  if (existing && existing.id !== id) {
    throw new DesktopError('Conflict', 'A tag with this name already exists')
  }
  return key
}

export function addTag(write: LibraryWrite, input: TagCreate) {
  const { db, now } = write
  const id = randomUUID()
  checkImages(db, imageIds(input))
  db.insert(tags)
    .values({
      id,
      name: input.name,
      nameKey: nameAvailable(db, input.name),
      description: input.description ?? null,
      isNsfw: input.isNsfw ?? false,
      createdAt: now,
      updatedAt: now,
    })
    .run()
  storeDescription(write, 'tag', id, input.description ?? null)
  write.changes.push({ type: 'tagCreated', tagId: id })
  return id
}
export function editTag(write: LibraryWrite, id: string, input: TagUpdate) {
  const { db, now } = write
  const row = db.select().from(tags).where(eq(tags.id, id)).get()
  if (!row) {
    throw new DesktopError('NotFound', 'The tag does not exist')
  }
  expectFields(row, input.expected)
  const fields = input.changes
  if (
    Object.entries(fields).every(([key, value]) => isDeepStrictEqual(value, Reflect.get(row, key)))
  ) {
    return
  }
  checkImages(db, imageIds(fields))
  if (fields.description !== undefined) {
    storeDescription(write, 'tag', id, fields.description)
  }
  db.update(tags)
    .set({
      ...fields,
      ...(fields.name && { nameKey: nameAvailable(db, fields.name, id) }),
      updatedAt: now,
    })
    .where(eq(tags.id, id))
    .run()
  write.changes.push({ type: 'tagUpdated', tagId: id })
}

import { storeDescription } from './description'
import { organizerMemberStorage } from './members'
import { organizerMergeStorage } from './merge'

export function organizerStorage(storage: Storage) {
  return {
    ...organizerMemberStorage(storage),
    ...organizerMergeStorage(storage),
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
    listLibraryTags(query: TagQuery, options: ListOptions, sensitive: boolean) {
      return storage.transaction((db) => {
        const terms = searchText(query.search).trim().split(/\s+/u).filter(Boolean)
        const used = sql`exists(select 1 from entry_tags l join entries e on e.id=l.entry_id where l.tag_id=${tags.id} and not l.is_spoiler ${sensitive ? sql.empty() : sql`and not e.is_nsfw`})`
        const where = and(
          sensitive ? undefined : eq(tags.isNsfw, false),
          query.used === undefined ? undefined : sql`${used}=${Number(query.used)}`,
          ...terms.map(
            (word) =>
              sql`(instr(library_text(${tags.name}),${word}) or instr(library_markdown(${tags.description}),${word}))`,
          ),
        )
        const order =
          query.sort.type === 'scope'
            ? sql`${tags.name} collate kisaki_name`
            : (query.sort.direction === 'asc' ? asc : desc)(
                query.sort.field === 'name'
                  ? sql`${tags.name} collate kisaki_name`
                  : tags[query.sort.field],
              )
        return {
          items: db
            .select({ id: tags.id, name: tags.name, isNsfw: tags.isNsfw })
            .from(tags)
            .where(where)
            .orderBy(order, tags.id)
            .limit(options.limit)
            .offset(options.offset)
            .all(),
          total: db.select({ n: count() }).from(tags).where(where).get()!.n,
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
    readLibraryTag: (id: string, sensitive: boolean) =>
      storage.db
        .select()
        .from(tags)
        .where(and(eq(tags.id, id), sensitive ? undefined : eq(tags.isNsfw, false)))
        .get() ?? null,

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

    addLibraryTag(input: TagCreate, images: readonly Attachment[]) {
      return commit(storage, (write) => {
        adoptAttachments(write.db, images)
        return addTag(write, input)
      })
    },
    editLibraryTag(id: string, input: TagUpdate, images: readonly Attachment[]) {
      return commit(storage, (write) => {
        adoptAttachments(write.db, images)
        editTag(write, id, input)
      })
    },
    deleteOrganizer(kind: 'collection' | 'tag', id: string) {
      return commit(storage, (write) => {
        const { db } = write
        const table = kind === 'tag' ? tags : collections
        const row = db.select().from(table).where(eq(table.id, id)).get()
        if (!row) {
          throw new DesktopError('NotFound', 'The selected library item no longer exists')
        }
        storeDescription(write, kind, id, null)
        if ('primaryImageId' in row && row.primaryImageId) {
          write.released.add(row.primaryImageId)
        }
        db.delete(table).where(eq(table.id, id)).run()
        write.changes.push(
          kind === 'tag'
            ? { type: 'tagDeleted', tagId: id, name: row.name }
            : { type: 'collectionDeleted', collectionId: id, name: row.name },
        )
      })
    },
  }
}
