import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { and, count, desc, eq, sql } from 'drizzle-orm'
import type {
  NoteCreate,
  NoteUpdate,
  NoteQuery,
  NoteOrderScope,
  NoteEntryChange,
  EntryRef,
  MoveInput,
  ReorderInput,
} from '@kisaki3/desktop-contracts/library'
import type { Attachment } from '@kisaki3/desktop-contracts/attachments'
import type { ListOptions } from '@kisaki3/desktop-contracts/operations'
import type { Storage } from '../../../../infrastructure/database'
import { adoptAttachments } from '../../../../infrastructure/attachments/storage'
import {
  entries,
  notes,
  noteContentAttachments as pictures,
  noteEntryLinks as links,
} from '../../../../infrastructure/database/schema'
import { readMarkdown } from '../../../../infrastructure/markdown'
import { searchText } from '../../../../infrastructure/database/search-text'
import { checkImages, inlineImages } from '../../attachments'
import { commit, expectFields, type LibraryWrite } from '../../transaction'
import { requireEntry } from '../../entries/tables'
import { noteEntries, requireNote, setNoteEntries, orderNoteLinks } from './members'

export function noteImages(value: { content?: string; primaryImageId?: string | null }) {
  return [
    ...new Set([
      ...(value.primaryImageId ? [value.primaryImageId] : []),
      ...inlineImages(value.content),
    ]),
  ]
}
function replacePictures(write: LibraryWrite, id: string, text: string) {
  const before = write.db
    .select({ id: pictures.attachmentId })
    .from(pictures)
    .where(eq(pictures.ownerId, id))
    .all()
    .map((row) => row.id)
  const next = new Set(inlineImages(text))
  for (const attachmentId of before) {
    if (!next.has(attachmentId)) {
      write.db
        .delete(pictures)
        .where(and(eq(pictures.ownerId, id), eq(pictures.attachmentId, attachmentId)))
        .run()
      write.released.add(attachmentId)
    }
  }
  for (const attachmentId of next) {
    if (!before.includes(attachmentId)) {
      write.db.insert(pictures).values({ ownerId: id, attachmentId }).run()
    }
  }
}
export function noteStorage(storage: Storage) {
  return {
    listNotes(query: NoteQuery, range: ListOptions, showSensitive: boolean) {
      return storage.transaction((db) => {
        const scope = query.scope
        const conditions = searchText(query.search)
          .trim()
          .split(/\s+/u)
          .filter(Boolean)
          .map(
            (term) =>
              sql`(instr(library_text(${notes.title}),${term}) or instr(library_markdown(${notes.content}),${term}))`,
          )
        let order = desc(notes.updatedAt)
        if (scope.type === 'entry') {
          requireEntry(db, scope.entry)
          const members = sql`select l.order_in_entry from note_entry_links l join entries e on e.id=l.entry_id where l.note_id=${notes.id} and e.id=${scope.entry.id} ${showSensitive ? sql.empty() : sql`and not e.is_nsfw`}`
          conditions.push(sql`exists(${members})`)
          order = sql`(${members})`
        } else if (scope.type === 'unassociated') {
          conditions.push(
            sql`not exists(select 1 from note_entry_links l where l.note_id=${notes.id})`,
          )
        }
        const where = and(...conditions)
        const rows = db
          .select()
          .from(notes)
          .where(where)
          .orderBy(order, notes.id)
          .limit(range.limit)
          .offset(range.offset)
          .all()
        return {
          items: rows.map(({ content, ...row }) => ({
            ...row,
            contentExcerpt: readMarkdown(content).text.trim().slice(0, 160) || null,
          })),
          total: db.select({ n: count() }).from(notes).where(where).get()!.n,
        }
      })
    },
    getNote: (id: string) => storage.db.select().from(notes).where(eq(notes.id, id)).get() ?? null,
    listNoteEntries(id: string, range: ListOptions, sensitive: boolean) {
      return storage.transaction((db) => {
        requireNote(db, id)
        const where = and(eq(links.noteId, id), sensitive ? undefined : eq(entries.isNsfw, false))
        const rows = db
          .select({ id: entries.id, type: entries.type })
          .from(links)
          .innerJoin(entries, eq(entries.id, links.entryId))
          .where(where)
          .orderBy(links.orderInNote, entries.id)
          .limit(range.limit)
          .offset(range.offset)
          .all()
        return {
          items: rows,
          total: db
            .select({ n: count() })
            .from(links)
            .innerJoin(entries, eq(entries.id, links.entryId))
            .where(where)
            .get()!.n,
        }
      })
    },
    createNote: (input: NoteCreate, images: readonly Attachment[]) =>
      commit(storage, (write) => {
        const id = randomUUID()
        adoptAttachments(write.db, images)
        checkImages(write.db, noteImages(input))
        write.db
          .insert(notes)
          .values({
            id,
            title: input.title ?? null,
            content: input.content ?? '',
            primaryImageId: input.primaryImageId ?? null,
            createdAt: write.now,
            updatedAt: write.now,
          })
          .run()
        replacePictures(write, id, input.content ?? '')
        if (input.entries) {
          setNoteEntries(write, id, { type: 'replace', items: input.entries })
        }
        write.changes.push({ type: 'noteCreated', noteId: id, entries: input.entries ?? [] })
        return id
      }),
    editNote: (id: string, input: NoteUpdate, images: readonly Attachment[]) =>
      commit(storage, (write) => {
        const saved = requireNote(write.db, id),
          before = noteEntries(write.db, id)
        expectFields({ ...saved, entries: before as readonly EntryRef[] }, input.expected)
        const { entries: next, ...fields } = input.changes
        const body = Object.entries(fields).some(
          ([key, value]) => !isDeepStrictEqual(Reflect.get(saved, key), value),
        )
        const links = next && setNoteEntries(write, id, { type: 'replace', items: next })
        if (!body && !links) {
          return
        }
        if (body) {
          adoptAttachments(write.db, images)
          checkImages(write.db, noteImages(fields))
          if (fields.content !== undefined) {
            replacePictures(write, id, fields.content)
          }
          if (
            fields.primaryImageId !== undefined &&
            saved.primaryImageId &&
            saved.primaryImageId !== fields.primaryImageId
          ) {
            write.released.add(saved.primaryImageId)
          }
          write.db
            .update(notes)
            .set({ ...fields, updatedAt: write.now })
            .where(eq(notes.id, id))
            .run()
        }
        write.changes.push({
          type: 'noteUpdated',
          noteId: id,
          entries: [...new Map([...before, ...(next ?? [])].map((ref) => [ref.id, ref])).values()],
        })
      }),
    editNoteEntries: (id: string, change: NoteEntryChange, expected?: readonly EntryRef[]) =>
      commit(storage, (write) => {
        requireNote(write.db, id)
        const before = noteEntries(write.db, id)
        if (setNoteEntries(write, id, change, expected)) {
          write.changes.push({
            type: 'noteUpdated',
            noteId: id,
            entries: [
              ...new Map(
                [...before, ...noteEntries(write.db, id)].map((ref) => [ref.id, ref]),
              ).values(),
            ],
          })
        }
      }),
    orderNoteEntries: (scope: NoteOrderScope, input: ReorderInput | MoveInput) =>
      commit(storage, (write) => orderNoteLinks(write, scope, input)),
    deleteNotes: (ids: readonly string[]) =>
      commit(storage, (write) => {
        for (const id of ids) {
          const saved = requireNote(write.db, id),
            entries = noteEntries(write.db, id)
          for (const image of noteImages(saved)) {
            write.released.add(image)
          }
          write.db.delete(notes).where(eq(notes.id, id)).run()
          write.changes.push({ type: 'noteDeleted', noteId: id, entries })
        }
      }),
  }
}
