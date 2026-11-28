import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { and, asc, count, desc, eq, sql } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  tagNameKey,
  type TagCreate,
  type TagQuery,
  type TagUpdate,
} from '@kisaki3/desktop-contracts/library'
import type { ListOptions } from '@kisaki3/desktop-contracts/operations'
import type { Attachment } from '@kisaki3/desktop-contracts/attachments'
import type { Storage } from '../../../../infrastructure/database'
import { tags } from '../../../../infrastructure/database/schema'
import { adoptAttachments } from '../../../../infrastructure/attachments/storage'
import { searchText } from '../../../../infrastructure/database/search-text'
import { commit, expectFields, type LibraryDatabase, type LibraryWrite } from '../../transaction'
import { checkImages, imageIds } from '../../attachments'

import { storeDescription } from '../description'
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

export function tagStorage(storage: Storage) {
  return {
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
    readLibraryTag: (id: string, sensitive: boolean) =>
      storage.db
        .select()
        .from(tags)
        .where(and(eq(tags.id, id), sensitive ? undefined : eq(tags.isNsfw, false)))
        .get() ?? null,

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
  }
}
