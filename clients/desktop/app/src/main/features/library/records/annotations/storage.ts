import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { eq } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  Annotation,
  AnnotationRef,
  AnnotationQuery,
  AnnotationCreate,
  AnnotationUpdate,
  AnnotationTargetByType,
  WorkType,
  WorkRef,
  FileWorkType,
} from '@kisaki3/desktop-contracts/library'
import type { Attachment } from '@kisaki3/desktop-contracts/attachments'
import type { ListOptions } from '@kisaki3/desktop-contracts/operations'
import type { Storage } from '../../../../infrastructure/database'
import { ready } from '../../../../infrastructure/database/codecs/json'
import { adoptAttachments } from '../../../../infrastructure/attachments/storage'
import { commit, expectFields, type LibraryWrite } from '../../transaction'
import { checkImages, inlineImages } from '../../attachments'
import { requireEntry } from '../../entries/tables'
import { fileRow } from '../../holdings/files/storage'
import { annotationWork, readAnnotation, listAnnotations, locations, tables } from './read'

export function annotationImages(content: string | undefined, image: string | null | undefined) {
  return [...new Set([...inlineImages(content), ...(image ? [image] : [])])]
}
function replaceImages(write: LibraryWrite, ref: AnnotationRef, content: string) {
  const table = tables[ref.workType].images
  const before = write.db
    .delete(table)
    .where(eq(table.ownerId, ref.id))
    .returning({ id: table.attachmentId })
    .all()
  const used = new Set(inlineImages(content))
  for (const image of before) {
    if (!used.has(image.id)) {
      write.released.add(image.id)
    }
  }
  for (const attachmentId of used) {
    write.db.insert(table).values({ ownerId: ref.id, attachmentId }).run()
  }
}
function targetOf(a: Annotation): AnnotationTargetByType[WorkType] {
  switch (a.workType) {
    case 'game':
      return { imageId: a.imageId }
    case 'anime':
      return { fileId: a.fileId, location: a.location, imageId: a.imageId }
    case 'comic':
    case 'novel':
      return { fileId: a.fileId, location: a.location, quote: a.quote, imageId: a.imageId }
  }
}
type AnnotationAction = 'annotationCreated' | 'annotationUpdated' | 'annotationDeleted'
function changed(
  write: LibraryWrite,
  type: AnnotationAction,
  annotationId: string,
  work: WorkRef,
  fileId: string | null,
) {
  if (work.type === 'game') {
    write.changes.push({ type, annotationId, work: { type: 'game', id: work.id } })
  } else {
    write.changes.push({ type, annotationId, work, fileId } as Extract<
      LibraryWrite['changes'][number],
      { type: AnnotationAction }
    >)
  }
}
function required(write: LibraryWrite, ref: AnnotationRef) {
  const row = readAnnotation(write.db, ref, true)
  if (!row) {
    throw new DesktopError('NotFound', 'The annotation no longer exists')
  }
  return row
}
export function annotationStorage(storage: Storage) {
  return {
    listAnnotations: (query: AnnotationQuery, range: ListOptions, sensitive: boolean) =>
      storage.transaction((db) => listAnnotations(db, query, range, sensitive)),
    getAnnotation: (ref: AnnotationRef, sensitive: boolean) =>
      storage.transaction((db) => readAnnotation(db, ref, sensitive)),
    annotationLocations: (
      work: WorkRef<FileWorkType>,
      file: string,
      range: ListOptions,
      sensitive: boolean,
    ) => storage.transaction((db) => locations(db, work, file, range, sensitive)),
    createAnnotation: (input: AnnotationCreate, images: readonly Attachment[]) =>
      commit(storage, (write) => {
        const id = randomUUID(),
          ref = { workType: input.workType, id },
          work = { type: input.workType, id: Reflect.get(input, input.workType + 'Id') as string }
        requireEntry(write.db, work)
        if ('fileId' in input.target && work.type !== 'game') {
          fileRow(write.db, { type: work.type, id: work.id }, input.target.fileId)
        }
        adoptAttachments(write.db, images)
        checkImages(write.db, annotationImages(input.content, input.target.imageId))
        const common = {
          id,
          title: input.title ?? null,
          content: input.content ?? '',
          createdAt: write.now,
          updatedAt: write.now,
        }
        switch (input.workType) {
          case 'game':
            write.db
              .insert(tables.game.table)
              .values({ ...common, gameId: input.gameId, ...input.target })
              .run()
            break
          case 'anime':
            write.db
              .insert(tables.anime.table)
              .values({
                ...common,
                animeId: input.animeId,
                ...input.target,
                location: ready(input.target.location),
              })
              .run()
            break
          case 'comic':
            write.db
              .insert(tables.comic.table)
              .values({
                ...common,
                comicId: input.comicId,
                ...input.target,
                location: ready(input.target.location),
              })
              .run()
            break
          case 'novel':
            write.db
              .insert(tables.novel.table)
              .values({
                ...common,
                novelId: input.novelId,
                ...input.target,
                location: ready(input.target.location),
              })
              .run()
            break
        }
        replaceImages(write, ref, common.content)
        changed(
          write,
          'annotationCreated',
          id,
          work,
          'fileId' in input.target ? input.target.fileId : null,
        )
        return id
      }),
    editAnnotation: (ref: AnnotationRef, input: AnnotationUpdate, images: readonly Attachment[]) =>
      commit(storage, (write) => {
        const row = required(write, ref),
          work = annotationWork(row),
          before = { title: row.title, content: row.content, target: targetOf(row) }
        expectFields(before, input.expected)
        if (
          Object.entries(input.changes).every(([key, value]) =>
            isDeepStrictEqual(value, Reflect.get(before, key)),
          )
        ) {
          return
        }
        const { target, ...fields } = input.changes
        if (target && 'fileId' in target && work.type !== 'game') {
          if (!target.fileId && 'fileId' in row && row.fileId) {
            throw new DesktopError(
              'InvalidInput',
              'A saved annotation cannot be detached from an existing file',
            )
          }
          if (target.fileId) {
            fileRow(write.db, { type: work.type, id: work.id }, target.fileId)
          }
        }
        adoptAttachments(write.db, images)
        checkImages(write.db, annotationImages(fields.content, target?.imageId))
        if (target && row.imageId && target.imageId !== row.imageId) {
          write.released.add(row.imageId)
        }
        if (fields.content !== undefined) {
          replaceImages(write, ref, fields.content)
        }
        const table = tables[ref.workType].table
        write.db
          .update(table)
          .set({
            ...fields,
            ...target,
            ...(target && 'location' in target && { location: ready(target.location) }),
            updatedAt: write.now,
          })
          .where(eq(table.id, ref.id))
          .run()
        const final = target ?? before.target
        changed(write, 'annotationUpdated', ref.id, work, 'fileId' in final ? final.fileId : null)
      }),
    deleteAnnotations: (refs: readonly AnnotationRef[]) =>
      commit(storage, (write) => {
        for (const ref of refs) {
          const row = required(write, ref)
          for (const image of annotationImages(row.content, row.imageId)) {
            write.released.add(image)
          }
          const table = tables[ref.workType].table
          write.db.delete(table).where(eq(table.id, ref.id)).run()
          changed(
            write,
            'annotationDeleted',
            ref.id,
            annotationWork(row),
            'fileId' in row ? row.fileId : null,
          )
        }
      }),
  }
}
