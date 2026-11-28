import { and, eq, max } from 'drizzle-orm'
import { isDeepStrictEqual } from 'node:util'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  EntryCollection,
  EntryCollectionChange,
  EntryRef,
} from '@kisaki3/desktop-contracts/library'
import { collectionMembers, collections } from '../../../../infrastructure/database/schema'
import type { LibraryDatabase, LibraryWrite } from '../../transaction'

export function entryCollections(db: LibraryDatabase, id: string) {
  return db
    .select({ collectionId: collectionMembers.collectionId, note: collectionMembers.note })
    .from(collectionMembers)
    .where(eq(collectionMembers.entryId, id))
    .orderBy(collectionMembers.collectionId)
    .all()
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
