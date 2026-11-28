import { and, eq, max } from 'drizzle-orm'
import { isDeepStrictEqual } from 'node:util'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  EntryTag,
  EntryTagChange,
  EntryCollection,
  EntryCollectionChange,
  EntryRef,
} from '@kisaki3/desktop-contracts/library'
import {
  entryTags,
  collectionMembers,
  collections,
  tags,
} from '../../../infrastructure/database/schema'
import type { LibraryDatabase, LibraryWrite } from '../transaction'

export function entryTagsInOrder(db: LibraryDatabase, id: string) {
  return db
    .select({ tagId: entryTags.tagId, note: entryTags.note, isSpoiler: entryTags.isSpoiler })
    .from(entryTags)
    .where(eq(entryTags.entryId, id))
    .orderBy(entryTags.orderInEntry, entryTags.tagId)
    .all()
}

export function entryCollections(db: LibraryDatabase, id: string) {
  return db
    .select({ collectionId: collectionMembers.collectionId, note: collectionMembers.note })
    .from(collectionMembers)
    .where(eq(collectionMembers.entryId, id))
    .orderBy(collectionMembers.collectionId)
    .all()
}

export function editEntryTags(
  write: LibraryWrite,
  entry: EntryRef,
  change: EntryTagChange,
  expected?: readonly EntryTag[],
) {
  const { db } = write
  const before = entryTagsInOrder(db, entry.id)
  if (expected && !isDeepStrictEqual(before, expected)) {
    throw new DesktopError('Conflict', 'The tags have changed')
  }
  const additions = change.type === 'replace' ? change.items : (change.add ?? [])
  const removed = new Set(change.type === 'modify' ? change.remove : [])
  for (const id of new Set([...removed, ...additions.map((row) => row.tagId)])) {
    if (!db.select({ id: tags.id }).from(tags).where(eq(tags.id, id)).get()) {
      throw new DesktopError('InvalidReference', 'The tag no longer exists')
    }
  }

  const after = new Map(
    (change.type === 'replace' ? [] : before.filter((row) => !removed.has(row.tagId))).map(
      (row) => [row.tagId, row],
    ),
  )
  for (const item of additions) {
    if (!after.has(item.tagId)) {
      after.set(item.tagId, {
        tagId: item.tagId,
        note: item.note ?? null,
        isSpoiler: item.isSpoiler ?? false,
      })
    }
  }
  if (isDeepStrictEqual(before, [...after.values()])) {
    return
  }

  for (const link of before) {
    if (!after.has(link.tagId)) {
      db.delete(entryTags)
        .where(and(eq(entryTags.entryId, entry.id), eq(entryTags.tagId, link.tagId)))
        .run()
    }
  }
  let orderInEntry = 0
  const existing = new Set(before.map((row) => row.tagId))
  for (const row of after.values()) {
    if (existing.has(row.tagId)) {
      db.update(entryTags)
        .set({ note: row.note, isSpoiler: row.isSpoiler, orderInEntry })
        .where(and(eq(entryTags.entryId, entry.id), eq(entryTags.tagId, row.tagId)))
        .run()
    } else {
      const last = db
        .select({ position: max(entryTags.orderInTag) })
        .from(entryTags)
        .where(eq(entryTags.tagId, row.tagId))
        .get()
      db.insert(entryTags)
        .values({ ...row, entryId: entry.id, orderInEntry, orderInTag: (last?.position ?? -1) + 1 })
        .run()
    }
    orderInEntry++
  }
  write.changes.push({
    type: 'entryTagsChanged',
    entry,
    tagIds: [...new Set([...before.map((row) => row.tagId), ...after.keys()])],
  })
}

export function editEntryCollections(
  write: LibraryWrite,
  entry: EntryRef,
  change: EntryCollectionChange,
  expected?: readonly EntryCollection[],
) {
  const { db } = write
  const before = entryCollections(db, entry.id)
  const original = new Map(before.map((row) => [row.collectionId, row.note]))
  if (
    expected &&
    !isDeepStrictEqual(original, new Map(expected.map((row) => [row.collectionId, row.note])))
  ) {
    throw new DesktopError('Conflict', 'The manual collection memberships have changed')
  }

  const picked = change.type === 'replace' ? change.items : (change.add ?? [])
  const removed = new Set(change.type === 'modify' ? change.remove : [])
  for (const id of new Set([...removed, ...picked.map((row) => row.collectionId)])) {
    const collection = db
      .select({ mode: collections.membershipMode })
      .from(collections)
      .where(eq(collections.id, id))
      .get()
    if (collection?.mode !== 'manual') {
      throw new DesktopError('InvalidReference', 'Choose an existing manual collection')
    }
  }
  const after = change.type === 'replace' ? new Map<string, string | null>() : new Map(original)
  for (const id of removed) {
    after.delete(id)
  }
  for (const row of picked) {
    if (!after.has(row.collectionId)) {
      after.set(row.collectionId, row.note ?? null)
    }
  }
  for (const id of new Set([...original.keys(), ...after.keys()])) {
    if (original.get(id) === after.get(id)) {
      continue
    }
    const target = and(
      eq(collectionMembers.entryId, entry.id),
      eq(collectionMembers.collectionId, id),
    )
    if (!after.has(id)) {
      db.delete(collectionMembers).where(target).run()
    } else if (original.has(id)) {
      db.update(collectionMembers)
        .set({ note: after.get(id)! })
        .where(target)
        .run()
    } else {
      const last = db
        .select({ position: max(collectionMembers.orderInCollection) })
        .from(collectionMembers)
        .where(eq(collectionMembers.collectionId, id))
        .get()
      db.insert(collectionMembers)
        .values({
          entryId: entry.id,
          collectionId: id,
          note: after.get(id)!,
          orderInCollection: (last?.position ?? -1) + 1,
        })
        .run()
    }
    write.changes.push({ type: 'collectionMembersChanged', collectionId: id, entries: [entry] })
  }
}
