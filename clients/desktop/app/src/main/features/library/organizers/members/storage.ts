import { isDeepStrictEqual } from 'node:util'
import { and, count, eq, asc, max, sql } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  EntryRef,
  CollectionMemberChange,
  TagEntryChange,
  CollectionMember,
  TagEntry,
  ReorderInput,
  MoveInput,
} from '@kisaki3/desktop-contracts/library'
import type { ListOptions } from '@kisaki3/desktop-contracts/operations'
import {
  collectionMembers as members,
  entryTags as applications,
  collections,
  tags,
  entries,
} from '../../../../infrastructure/database/schema'
import type { Storage } from '../../../../infrastructure/database'
import { commit, expectFields, type LibraryWrite, type LibraryDatabase } from '../../transaction'
import { requireEntry } from '../../entries/tables'
import { orderedIds } from '../../ordering'

export type Organizer = 'collection' | 'tag'
export function requireOrganizer(db: LibraryDatabase, kind: Organizer, id: string, manual = true) {
  const table = kind === 'collection' ? collections : tags,
    row = db.select().from(table).where(eq(table.id, id)).get()
  if (!row) {
    throw new DesktopError('InvalidReference', 'The selected organizer is unavailable')
  }
  if (manual && 'membershipMode' in row && row.membershipMode !== 'manual') {
    throw new DesktopError(
      'UnsupportedMembershipMode',
      'Convert this collection to manual membership first',
    )
  }
  return row
}
export function organizerMembers(
  db: LibraryDatabase,
  kind: Organizer,
  id: string,
  range?: ListOptions,
  sensitive = true,
) {
  const target = requireOrganizer(db, kind, id)
  if (!sensitive && target.isNsfw) {
    return { items: [], total: 0 }
  }
  const table = kind === 'collection' ? members : applications,
    owner = kind === 'collection' ? members.collectionId : applications.tagId,
    order = kind === 'collection' ? members.orderInCollection : applications.orderInTag
  const where = and(
    eq(owner, id),
    !sensitive ? eq(entries.isNsfw, false) : undefined,
    kind === 'tag' && range ? eq(applications.isSpoiler, false) : undefined,
  )
  const query = db
    .select({
      entry: { id: entries.id, type: entries.type },
      note: table.note,
      ...(kind === 'tag' && { isSpoiler: applications.isSpoiler }),
    })
    .from(table)
    .innerJoin(entries, eq(entries.id, table.entryId))
    .where(where)
    .orderBy(asc(order), table.entryId)
    .$dynamic()
  return {
    items: (range ? query.limit(range.limit).offset(range.offset) : query).all() as (
      | CollectionMember
      | TagEntry
    )[],
    total: db
      .select({ n: count() })
      .from(table)
      .innerJoin(entries, eq(entries.id, table.entryId))
      .where(where)
      .get()!.n,
  }
}
function changed(write: LibraryWrite, kind: Organizer, id: string, refs: readonly EntryRef[]) {
  if (kind === 'collection') {
    write.changes.push({ type: 'collectionMembersChanged', collectionId: id, entries: refs })
  } else {
    for (const entry of refs) {
      write.changes.push({ type: 'entryTagsChanged', entry, tagIds: [id] })
    }
  }
}
export function replaceMembers(
  write: LibraryWrite,
  kind: Organizer,
  id: string,
  change: CollectionMemberChange | TagEntryChange,
  expected?: readonly (CollectionMember | TagEntry)[],
) {
  const { db } = write,
    before = organizerMembers(db, kind, id).items
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
        ...(kind === 'tag' && { isSpoiler: 'isSpoiler' in row && row.isSpoiler === true }),
      })
    }
  }
  const values = [...desired.values()]
  if (isDeepStrictEqual(before, values)) {
    return
  }
  const table = kind === 'collection' ? members : applications,
    owner = kind === 'collection' ? members.collectionId : applications.tagId
  for (const row of before) {
    if (!desired.has(row.entry.id)) {
      db.delete(table)
        .where(and(eq(owner, id), eq(table.entryId, row.entry.id)))
        .run()
    }
  }
  for (const [index, row] of values.entries()) {
    const previous = original.get(row.entry.id)
    if (previous && previous.index === index && isDeepStrictEqual(previous.row, row)) {
      continue
    }
    if (kind === 'collection') {
      db.insert(members)
        .values({
          entryId: row.entry.id,
          collectionId: id,
          note: row.note,
          orderInCollection: index,
        })
        .onConflictDoUpdate({
          target: [members.collectionId, members.entryId],
          set: { note: row.note, orderInCollection: index },
        })
        .run()
    } else {
      const fields = {
        note: row.note,
        isSpoiler: 'isSpoiler' in row && row.isSpoiler,
        orderInTag: index,
      }
      if (previous) {
        db.update(applications)
          .set(fields)
          .where(and(eq(applications.tagId, id), eq(applications.entryId, row.entry.id)))
          .run()
      } else {
        const last =
          db
            .select({ n: max(applications.orderInEntry) })
            .from(applications)
            .where(eq(applications.entryId, row.entry.id))
            .get()!.n ?? -1
        db.insert(applications)
          .values({ ...fields, tagId: id, entryId: row.entry.id, orderInEntry: last + 1 })
          .run()
      }
    }
  }
  changed(write, kind, id, [
    ...new Map([...before, ...values].map((row) => [row.entry.id, row.entry])).values(),
  ])
}
export function organizerMemberStorage(storage: Storage) {
  return {
    listOrganizerMembers: (kind: Organizer, id: string, range: ListOptions, sensitive: boolean) =>
      storage.transaction((db) => organizerMembers(db, kind, id, range, sensitive)),
    changeOrganizerMembers: (
      kind: Organizer,
      id: string,
      change: CollectionMemberChange | TagEntryChange,
      expected?: readonly (CollectionMember | TagEntry)[],
    ) => commit(storage, (w) => replaceMembers(w, kind, id, change, expected)),
    setOrganizerMemberFields: (
      kind: Organizer,
      id: string,
      entry: EntryRef,
      changes: { note?: string | null; isSpoiler?: boolean },
      expected?: { note?: string | null; isSpoiler?: boolean },
    ) =>
      commit(storage, (write) => {
        requireOrganizer(write.db, kind, id)
        requireEntry(write.db, entry)
        const table = kind === 'tag' ? applications : members,
          owner = kind === 'tag' ? applications.tagId : members.collectionId,
          where = and(eq(owner, id), eq(table.entryId, entry.id))
        const row = write.db.select().from(table).where(where).get()
        if (!row) {
          throw new DesktopError('InvalidReference', 'The entry is not a member here')
        }
        expectFields(row, expected)
        if (Object.entries(changes).every(([k, v]) => Reflect.get(row, k) === v)) {
          return
        }
        write.db.update(table).set(changes).where(where).run()
        changed(write, kind, id, [entry])
      }),
    orderOrganizerMembers: (
      kind: Organizer,
      id: string,
      input: ReorderInput | MoveInput,
      refs: readonly EntryRef[],
    ) =>
      commit(storage, (write) => {
        for (const ref of refs) {
          requireEntry(write.db, ref)
        }
        const rows = organizerMembers(write.db, kind, id).items,
          current = rows.map((row) => row.entry.id),
          next = orderedIds(current, input)
        if (isDeepStrictEqual(current, next)) {
          return
        }
        const table = kind === 'tag' ? applications : members,
          owner = kind === 'tag' ? applications.tagId : members.collectionId,
          order = kind === 'tag' ? applications.orderInTag : members.orderInCollection
        next.forEach((entry, i) => {
          if (current[i] !== entry) {
            write.db.run(
              sql`update ${table} set ${sql.identifier(order.name)}=${i} where ${owner}=${id} and ${table.entryId}=${entry}`,
            )
          }
        })
        changed(
          write,
          kind,
          id,
          rows.map((r) => r.entry),
        )
      }),
  }
}
