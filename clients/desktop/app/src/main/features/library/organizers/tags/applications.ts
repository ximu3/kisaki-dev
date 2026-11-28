import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { EntryRef, EntryTag, EntryTagChange } from '@kisaki3/desktop-contracts/library'
import { and, eq, inArray, max, min } from 'drizzle-orm'
import { isDeepStrictEqual } from 'node:util'
import { entryTags, tags } from '../../../../infrastructure/database/schema'
import { mergeText } from '../../text'
import type { LibraryDatabase, LibraryWrite } from '../../transaction'

import type {
  MoveInput,
  ReorderInput,
  TagEntry,
  TagEntryChange,
} from '@kisaki3/desktop-contracts/library'
import type { ListOptions } from '@kisaki3/desktop-contracts/operations'
import { count, sql } from 'drizzle-orm'
import type { Storage } from '../../../../infrastructure/database'
import { entries } from '../../../../infrastructure/database/schema'
import { requireEntry } from '../../entries/tables'
import { orderedIds } from '../../ordering'
import { commit, expectFields } from '../../transaction'

export function moveEntryTags(write: LibraryWrite, source: EntryRef, target: EntryRef) {
  const kept = new Map(entryTagsInOrder(write.db, target.id).map((tag) => [tag.tagId, tag]))
  for (const tag of entryTagsInOrder(write.db, source.id)) {
    const was = kept.get(tag.tagId)
    kept.set(
      tag.tagId,
      was
        ? {
            tagId: tag.tagId,
            note: mergeText(was.note, tag.note),
            isSpoiler: was.isSpoiler || tag.isSpoiler,
          }
        : tag,
    )
  }
  editEntryTags(write, target, { type: 'replace', items: [...kept.values()] })
}

export function entryTagsInOrder(db: LibraryDatabase, id: string) {
  return db
    .select({ tagId: entryTags.tagId, note: entryTags.note, isSpoiler: entryTags.isSpoiler })
    .from(entryTags)
    .where(eq(entryTags.entryId, id))
    .orderBy(entryTags.orderInEntry, entryTags.tagId)
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

export function requireTag(db: LibraryDatabase, id: string) {
  const row = db.select().from(tags).where(eq(tags.id, id)).get()
  if (!row) {
    throw new DesktopError('InvalidReference', 'The selected tag is unavailable')
  }
  return row
}

export function readTagEntries(
  db: LibraryDatabase,
  id: string,
  range?: ListOptions,
  sensitive = true,
) {
  const owner = requireTag(db, id)
  if (!sensitive && owner.isNsfw) {
    return { items: [], total: 0 }
  }
  const where = and(
    eq(entryTags.tagId, id),
    sensitive ? undefined : eq(entries.isNsfw, false),
    range ? eq(entryTags.isSpoiler, false) : undefined,
  )
  const query = db
    .select({
      entry: { id: entries.id, type: entries.type },
      note: entryTags.note,
      isSpoiler: entryTags.isSpoiler,
    })
    .from(entryTags)
    .innerJoin(entries, eq(entries.id, entryTags.entryId))
    .where(where)
    .orderBy(entryTags.orderInTag, entryTags.entryId)
    .$dynamic()
  const items = (range ? query.limit(range.limit).offset(range.offset) : query).all()
  const total = range
    ? db
        .select({ n: count() })
        .from(entryTags)
        .innerJoin(entries, eq(entries.id, entryTags.entryId))
        .where(where)
        .get()!.n
    : items.length
  return { items, total }
}

function changed(write: LibraryWrite, id: string, refs: readonly EntryRef[]) {
  for (const entry of refs) {
    write.changes.push({ type: 'entryTagsChanged', entry, tagIds: [id] })
  }
}

export function changeTagEntries(
  write: LibraryWrite,
  id: string,
  change: TagEntryChange,
  expected?: readonly TagEntry[],
) {
  const { db } = write,
    before = readTagEntries(db, id).items
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
        isSpoiler: row.isSpoiler ?? false,
      })
    }
  }
  const values = [...desired.values()]
  if (isDeepStrictEqual(before, values)) {
    return
  }
  for (const row of before) {
    if (!desired.has(row.entry.id)) {
      db.delete(entryTags)
        .where(and(eq(entryTags.tagId, id), eq(entryTags.entryId, row.entry.id)))
        .run()
    }
  }
  for (const [index, row] of values.entries()) {
    const previous = original.get(row.entry.id)
    if (previous && previous.index === index && isDeepStrictEqual(previous.row, row)) {
      continue
    }
    const fields = {
      note: row.note,
      isSpoiler: row.isSpoiler,
      orderInTag: index,
    }
    if (previous) {
      db.update(entryTags)
        .set(fields)
        .where(and(eq(entryTags.tagId, id), eq(entryTags.entryId, row.entry.id)))
        .run()
    } else {
      const last =
        db
          .select({ n: max(entryTags.orderInEntry) })
          .from(entryTags)
          .where(eq(entryTags.entryId, row.entry.id))
          .get()!.n ?? -1
      db.insert(entryTags)
        .values({ ...fields, tagId: id, entryId: row.entry.id, orderInEntry: last + 1 })
        .run()
    }
  }
  changed(write, id, [
    ...new Map([...before, ...values].map((row) => [row.entry.id, row.entry])).values(),
  ])
}

export function tagEntriesStorage(storage: Storage) {
  return {
    listTagEntries: (id: string, range: ListOptions, sensitive: boolean) =>
      storage.transaction((db) => readTagEntries(db, id, range, sensitive)),
    editTagEntries: (id: string, change: TagEntryChange, expected?: readonly TagEntry[]) =>
      commit(storage, (w) => changeTagEntries(w, id, change, expected)),
    updateTagEntry: (
      id: string,
      entry: EntryRef,
      changes: { note?: string | null; isSpoiler?: boolean },
      expected?: { note?: string | null; isSpoiler?: boolean },
    ) =>
      commit(storage, (write) => {
        requireTag(write.db, id)
        requireEntry(write.db, entry)
        const where = and(eq(entryTags.tagId, id), eq(entryTags.entryId, entry.id))
        const row = write.db.select().from(entryTags).where(where).get()
        if (!row) {
          throw new DesktopError('InvalidReference', 'The entry is not a member here')
        }
        expectFields(row, expected)
        if (Object.entries(changes).every(([k, v]) => Reflect.get(row, k) === v)) {
          return
        }
        write.db.update(entryTags).set(changes).where(where).run()
        changed(write, id, [entry])
      }),
    orderTagEntries: (id: string, input: ReorderInput | MoveInput, refs: readonly EntryRef[]) =>
      commit(storage, (write) => {
        for (const ref of refs) {
          requireEntry(write.db, ref)
        }
        const rows = readTagEntries(write.db, id).items,
          current = rows.map((row) => row.entry.id),
          next = orderedIds(current, input)
        if (isDeepStrictEqual(current, next)) {
          return
        }
        const order = entryTags.orderInTag
        next.forEach((entry, i) => {
          if (current[i] !== entry) {
            write.db.run(
              sql`update ${entryTags} set ${sql.identifier(order.name)}=${i} where ${entryTags.tagId}=${id} and ${entryTags.entryId}=${entry}`,
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

export function keepMergedTagPositions(
  db: LibraryDatabase,
  sourceIds: readonly string[],
  targetId: string,
  memberIds: Iterable<string>,
  previousMembers: ReadonlySet<string>,
) {
  for (const entryId of memberIds) {
    if (!previousMembers.has(entryId)) {
      const where = eq(entryTags.entryId, entryId),
        slot = db
          .select({ order: min(entryTags.orderInEntry) })
          .from(entryTags)
          .where(and(where, inArray(entryTags.tagId, sourceIds)))
          .get()!.order
      if (slot !== null) {
        db.update(entryTags)
          .set({ orderInEntry: slot })
          .where(and(where, eq(entryTags.tagId, targetId)))
          .run()
      }
    }
  }
}
