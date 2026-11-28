import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  EntryCollection,
  EntryCollectionChange,
  EntryRef,
} from '@kisaki3/desktop-contracts/library'
import { and, eq, max } from 'drizzle-orm'
import { isDeepStrictEqual } from 'node:util'
import { collectionMembers, collections } from '../../../../infrastructure/database/schema'
import { mergeText } from '../../text'
import type { LibraryDatabase, LibraryWrite } from '../../transaction'

import type {
  CollectionMember,
  CollectionMemberChange,
  MoveInput,
  ReorderInput,
} from '@kisaki3/desktop-contracts/library'
import type { ListOptions } from '@kisaki3/desktop-contracts/operations'
import { count, sql } from 'drizzle-orm'
import type { Storage } from '../../../../infrastructure/database'
import { entries } from '../../../../infrastructure/database/schema'
import { requireEntry } from '../../entries/tables'
import { orderedIds } from '../../ordering'
import { commit, expectFields } from '../../transaction'

export function moveCollectionMembers(write: LibraryWrite, source: EntryRef, target: EntryRef) {
  const { db } = write
  for (const row of db
    .select()
    .from(collectionMembers)
    .where(eq(collectionMembers.entryId, source.id))
    .all()) {
    const scope = eq(collectionMembers.collectionId, row.collectionId),
      where = and(scope, eq(collectionMembers.entryId, target.id))
    const before = db.select().from(collectionMembers).where(where).get()
    if (before) {
      db.update(collectionMembers)
        .set({ note: mergeText(before.note, row.note) })
        .where(where)
        .run()
    } else {
      const last =
        db
          .select({ n: max(collectionMembers.orderInCollection) })
          .from(collectionMembers)
          .where(scope)
          .get()!.n ?? -1
      db.insert(collectionMembers)
        .values({ ...row, entryId: target.id, orderInCollection: last + 1 })
        .run()
    }
    changed(write, row.collectionId, [source, target])
  }
}

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
    changed(write, id, [entry])
  }
}

export function requireManualCollection(db: LibraryDatabase, id: string) {
  const row = db.select().from(collections).where(eq(collections.id, id)).get()
  if (!row) {
    throw new DesktopError('InvalidReference', 'The selected collection is unavailable')
  }
  if (row.membershipMode !== 'manual') {
    throw new DesktopError(
      'UnsupportedMembershipMode',
      'Convert this collection to manual membership first',
    )
  }
  return row
}

export function readCollectionMembers(
  db: LibraryDatabase,
  id: string,
  range?: ListOptions,
  sensitive = true,
) {
  const owner = requireManualCollection(db, id)
  if (!sensitive && owner.isNsfw) {
    return { items: [], total: 0 }
  }
  const where = and(
    eq(collectionMembers.collectionId, id),
    sensitive ? undefined : eq(entries.isNsfw, false),
  )
  const query = db
    .select({ entry: { id: entries.id, type: entries.type }, note: collectionMembers.note })
    .from(collectionMembers)
    .innerJoin(entries, eq(entries.id, collectionMembers.entryId))
    .where(where)
    .orderBy(collectionMembers.orderInCollection, collectionMembers.entryId)
    .$dynamic()
  const items = (range ? query.limit(range.limit).offset(range.offset) : query).all()
  const total = range
    ? db
        .select({ n: count() })
        .from(collectionMembers)
        .innerJoin(entries, eq(entries.id, collectionMembers.entryId))
        .where(where)
        .get()!.n
    : items.length
  return { items, total }
}

function changed(write: LibraryWrite, id: string, refs: readonly EntryRef[]) {
  write.db.update(collections).set({ updatedAt: write.now }).where(eq(collections.id, id)).run()
  write.changes.push({ type: 'collectionMembersChanged', collectionId: id, entries: refs })
}

export function changeCollectionMembers(
  write: LibraryWrite,
  id: string,
  change: CollectionMemberChange,
  expected?: readonly CollectionMember[],
) {
  const { db } = write,
    before = readCollectionMembers(db, id).items
  if (expected && !isDeepStrictEqual(before, expected)) {
    throw new DesktopError('Conflict', 'The saved member list changed')
  }
  const additions = change.type === 'replace' ? change.items : (change.add ?? []),
    removed = change.type === 'modify' ? (change.remove ?? []) : []
  const removedIds = new Set(removed.map((ref) => ref.id)),
    original = new Map(before.map((row, index) => [row.entry.id, { row, index }]))
  const desired = new Map(
    (change.type === 'replace' ? [] : before.filter((row) => !removedIds.has(row.entry.id))).map(
      (row) => [row.entry.id, row],
    ),
  )
  for (const ref of [...additions.map((row) => row.entry), ...removed]) {
    requireEntry(db, ref)
  }
  for (const row of additions) {
    if (!desired.has(row.entry.id)) {
      desired.set(row.entry.id, {
        entry: row.entry,
        note: row.note ?? null,
      })
    }
  }
  const values = [...desired.values()]
  if (isDeepStrictEqual(before, values)) {
    return
  }
  for (const row of before) {
    if (!desired.has(row.entry.id)) {
      db.delete(collectionMembers)
        .where(
          and(eq(collectionMembers.collectionId, id), eq(collectionMembers.entryId, row.entry.id)),
        )
        .run()
    }
  }
  for (const [index, row] of values.entries()) {
    const previous = original.get(row.entry.id)
    if (previous && previous.index === index && isDeepStrictEqual(previous.row, row)) {
      continue
    }
    db.insert(collectionMembers)
      .values({
        entryId: row.entry.id,
        collectionId: id,
        note: row.note,
        orderInCollection: index,
      })
      .onConflictDoUpdate({
        target: [collectionMembers.collectionId, collectionMembers.entryId],
        set: { note: row.note, orderInCollection: index },
      })
      .run()
  }
  changed(write, id, [
    ...new Map([...before, ...values].map((row) => [row.entry.id, row.entry])).values(),
  ])
}

export function collectionMembersStorage(storage: Storage) {
  return {
    listCollectionMembers: (id: string, range: ListOptions, sensitive: boolean) =>
      storage.transaction((db) => readCollectionMembers(db, id, range, sensitive)),
    editCollectionMembers: (
      id: string,
      change: CollectionMemberChange,
      expected?: readonly CollectionMember[],
    ) => commit(storage, (w) => changeCollectionMembers(w, id, change, expected)),
    updateCollectionMember: (
      id: string,
      entry: EntryRef,
      changes: { note?: string | null },
      expected?: { note?: string | null },
    ) =>
      commit(storage, (write) => {
        requireManualCollection(write.db, id)
        requireEntry(write.db, entry)
        const where = and(
          eq(collectionMembers.collectionId, id),
          eq(collectionMembers.entryId, entry.id),
        )
        const row = write.db.select().from(collectionMembers).where(where).get()
        if (!row) {
          throw new DesktopError('InvalidReference', 'The entry is not a member here')
        }
        expectFields(row, expected)
        if (Object.entries(changes).every(([k, v]) => Reflect.get(row, k) === v)) {
          return
        }
        write.db.update(collectionMembers).set(changes).where(where).run()
        changed(write, id, [entry])
      }),
    orderCollectionMembers: (
      id: string,
      input: ReorderInput | MoveInput,
      refs: readonly EntryRef[],
    ) =>
      commit(storage, (write) => {
        for (const ref of refs) {
          requireEntry(write.db, ref)
        }
        const rows = readCollectionMembers(write.db, id).items,
          current = rows.map((row) => row.entry.id),
          next = orderedIds(current, input)
        if (isDeepStrictEqual(current, next)) {
          return
        }
        const order = collectionMembers.orderInCollection
        next.forEach((entry, i) => {
          if (current[i] !== entry) {
            write.db.run(
              sql`update ${collectionMembers} set ${sql.identifier(order.name)}=${i} where ${collectionMembers.collectionId}=${id} and ${collectionMembers.entryId}=${entry}`,
            )
          }
        })
        changed(
          write,
          id,
          rows.map((r) => r.entry),
        )
      }),
  }
}
