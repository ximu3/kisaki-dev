import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  EntryRef,
  MoveInput,
  NoteEntryChange,
  NoteOrderScope,
  ReorderInput,
} from '@kisaki3/desktop-contracts/library'
import { and, eq, max } from 'drizzle-orm'
import { isDeepStrictEqual } from 'node:util'
import {
  entries,
  noteEntryLinks as links,
  noteEntryLinks,
  notes,
} from '../../../../infrastructure/database/schema'
import { requireEntry } from '../../entries/tables'
import { orderedIds } from '../../ordering'
import type { LibraryDatabase, LibraryWrite } from '../../transaction'

export function moveNoteLinks(write: LibraryWrite, source: EntryRef, target: EntryRef) {
  const { db } = write
  let next =
    (db
      .select({ n: max(links.orderInEntry) })
      .from(links)
      .where(eq(links.entryId, target.id))
      .get()!.n ?? -1) + 1
  for (const row of db
    .select()
    .from(links)
    .where(eq(links.entryId, source.id))
    .orderBy(links.orderInEntry, links.noteId)
    .all()) {
    const where = and(eq(links.noteId, row.noteId), eq(links.entryId, target.id))
    if (!db.select({ id: links.noteId }).from(links).where(where).get()) {
      db.insert(links)
        .values({ ...row, entryId: target.id, orderInEntry: next++ })
        .run()
    }
    write.changes.push({ type: 'noteUpdated', noteId: row.noteId, entries: [source, target] })
  }
}

export function unlinkEntryNotes(write: LibraryWrite, ref: EntryRef) {
  for (const row of write.db
    .select({ id: noteEntryLinks.noteId })
    .from(noteEntryLinks)
    .where(eq(noteEntryLinks.entryId, ref.id))
    .all()) {
    write.changes.push({ type: 'noteUpdated', noteId: row.id, entries: [ref] })
  }
}

export function requireNote(db: LibraryDatabase, id: string) {
  const note = db.select().from(notes).where(eq(notes.id, id)).get()
  if (!note) {
    throw new DesktopError('NotFound', 'The note no longer exists')
  }
  return note
}

export function noteEntries(db: LibraryDatabase, id: string) {
  return db
    .select({ type: entries.type, id: entries.id })
    .from(links)
    .innerJoin(entries, eq(entries.id, links.entryId))
    .where(eq(links.noteId, id))
    .orderBy(links.orderInNote, links.entryId)
    .all()
}

export function setNoteEntries(
  write: LibraryWrite,
  id: string,
  change: NoteEntryChange,
  expected?: readonly EntryRef[],
) {
  const { db } = write,
    before = noteEntries(db, id)
  if (expected && !isDeepStrictEqual(before, expected)) {
    throw new DesktopError('Conflict', 'The note’s entry associations have changed')
  }
  const add = change.type === 'replace' ? change.items : (change.add ?? []),
    remove = new Set(change.type === 'modify' ? change.remove?.map((ref) => ref.id) : [])
  for (const ref of [...add, ...(change.type === 'modify' ? (change.remove ?? []) : [])]) {
    requireEntry(db, ref)
  }
  const after = new Map(
    (change.type === 'replace' ? [] : before.filter((ref) => !remove.has(ref.id))).map((ref) => [
      ref.id,
      ref,
    ]),
  )
  for (const ref of add) {
    after.set(ref.id, ref)
  }
  if (isDeepStrictEqual(before, [...after.values()])) {
    return false
  }
  const saved = new Map(before.map((ref, i) => [ref.id, i]))
  for (const ref of before) {
    if (!after.has(ref.id)) {
      db.delete(links)
        .where(and(eq(links.noteId, id), eq(links.entryId, ref.id)))
        .run()
    }
  }
  let orderInNote = 0
  for (const ref of after.values()) {
    if (!saved.has(ref.id)) {
      const { n } = db
        .select({ n: max(links.orderInEntry) })
        .from(links)
        .where(eq(links.entryId, ref.id))
        .get()!
      db.insert(links)
        .values({ noteId: id, entryId: ref.id, orderInNote, orderInEntry: (n ?? -1) + 1 })
        .run()
    } else if (saved.get(ref.id) !== orderInNote) {
      db.update(links)
        .set({ orderInNote })
        .where(and(eq(links.noteId, id), eq(links.entryId, ref.id)))
        .run()
    }
    orderInNote++
  }
  return true
}

export function orderNoteLinks(
  write: LibraryWrite,
  scope: NoteOrderScope,
  input: ReorderInput | MoveInput,
) {
  const { db } = write
  if (scope.type === 'note') {
    requireNote(db, scope.noteId)
  } else {
    requireEntry(db, scope.entry)
  }
  const [owner, other, order, key] =
    scope.type === 'note'
      ? ([links.noteId, links.entryId, links.orderInNote, scope.noteId] as const)
      : ([links.entryId, links.noteId, links.orderInEntry, scope.entry.id] as const)
  const before = db
    .select({ id: other })
    .from(links)
    .where(eq(owner, key))
    .orderBy(order, other)
    .all()
    .map((row) => row.id)
  const next = orderedIds(before, input)
  if (isDeepStrictEqual(next, before)) {
    return
  }
  next.forEach((id, i) => {
    if (before[i] === id) {
      return
    }
    db.update(links)
      .set(scope.type === 'note' ? { orderInNote: i } : { orderInEntry: i })
      .where(and(eq(owner, key), eq(other, id)))
      .run()
    if (scope.type === 'entry') {
      write.changes.push({ type: 'noteUpdated', noteId: id, entries: [scope.entry] })
    }
  })
  if (scope.type === 'note') {
    write.changes.push({
      type: 'noteUpdated',
      noteId: scope.noteId,
      entries: noteEntries(db, scope.noteId),
    })
  }
}
