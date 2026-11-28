import { and, eq, max } from 'drizzle-orm'
import type { EntryRef } from '@kisaki3/desktop-contracts/library'
import {
  collectionMembers as collections,
  noteEntryLinks as notes,
} from '../../../../infrastructure/database/schema'
import { editEntryTags, entryTagsInOrder } from '../../organizers/tags/applications'
import type { LibraryWrite } from '../../transaction'
import { mergeText } from './fields'
export function mergeMembers(write: LibraryWrite, source: EntryRef, target: EntryRef) {
  const { db } = write,
    kept = new Map(entryTagsInOrder(db, target.id).map((tag) => [tag.tagId, tag]))
  for (const tag of entryTagsInOrder(db, source.id)) {
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
  for (const row of db.select().from(collections).where(eq(collections.entryId, source.id)).all()) {
    const scope = eq(collections.collectionId, row.collectionId),
      where = and(scope, eq(collections.entryId, target.id))
    const before = db.select().from(collections).where(where).get()
    if (before) {
      db.update(collections)
        .set({ note: mergeText(before.note, row.note) })
        .where(where)
        .run()
    } else {
      const last =
        db
          .select({ n: max(collections.orderInCollection) })
          .from(collections)
          .where(scope)
          .get()!.n ?? -1
      db.insert(collections)
        .values({ ...row, entryId: target.id, orderInCollection: last + 1 })
        .run()
    }
    write.changes.push({
      type: 'collectionMembersChanged',
      collectionId: row.collectionId,
      entries: [source, target],
    })
  }
  let next =
    (db
      .select({ n: max(notes.orderInEntry) })
      .from(notes)
      .where(eq(notes.entryId, target.id))
      .get()!.n ?? -1) + 1
  for (const row of db
    .select()
    .from(notes)
    .where(eq(notes.entryId, source.id))
    .orderBy(notes.orderInEntry, notes.noteId)
    .all()) {
    const where = and(eq(notes.noteId, row.noteId), eq(notes.entryId, target.id))
    if (!db.select({ id: notes.noteId }).from(notes).where(where).get()) {
      db.insert(notes)
        .values({ ...row, entryId: target.id, orderInEntry: next++ })
        .run()
    }
    write.changes.push({ type: 'noteUpdated', noteId: row.noteId, entries: [source, target] })
  }
}
