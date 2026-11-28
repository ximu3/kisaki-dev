import { isDeepStrictEqual } from 'node:util'
import { and, eq, count } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  PartRef,
  VolumeChapterChange,
  VolumeChapter,
  MoveInput,
  ReorderInput,
} from '@kisaki3/desktop-contracts/library'
import type { ListOptions } from '@kisaki3/desktop-contracts/operations'
import type { Storage } from '../../../../infrastructure/database'
import { commit, expectFields, type LibraryDatabase, type LibraryWrite } from '../../transaction'
import { comicVolumeChapters as members } from '../../../../infrastructure/database/schema'
import { orderedIds } from '../../ordering'
import { requirePart } from '../write'

function chapterRow(row: typeof members.$inferSelect): VolumeChapter {
  return { chapter: { type: 'comicChapter', id: row.chapterId }, numberLabel: row.numberLabel }
}

export function volumeMembers(
  db: LibraryDatabase,
  volume: PartRef<'comicVolume'>,
  range: ListOptions,
) {
  requirePart(db, volume)
  const where = eq(members.volumeId, volume.id)
  const rows = db
    .select()
    .from(members)
    .where(where)
    .orderBy(members.sortOrder, members.chapterId)
    .limit(range.limit)
    .offset(range.offset)
    .all()
  return {
    total: db.select({ n: count() }).from(members).where(where).get()!.n,
    items: rows.map(chapterRow),
  }
}

export function editVolumeMembers(
  write: LibraryWrite,
  volume: PartRef<'comicVolume'>,
  change: VolumeChapterChange,
  expected?: readonly VolumeChapter[],
) {
  const part = requirePart(write.db, volume)
  const before = write.db
    .select()
    .from(members)
    .where(eq(members.volumeId, volume.id))
    .orderBy(members.sortOrder, members.chapterId)
    .all()
    .map(chapterRow)
  if (expected && !isDeepStrictEqual(before, expected)) {
    throw new DesktopError('Conflict', 'The chapters of this volume have changed')
  }
  const add = change.type === 'replace' ? change.items : (change.add ?? []),
    remove = change.type === 'modify' ? (change.remove ?? []) : []
  for (const ref of [...add.map((row) => row.chapter), ...remove]) {
    if (requirePart(write.db, ref).work.id !== part.work.id) {
      throw new DesktopError('InvalidReference', 'Choose a chapter of the same comic')
    }
  }
  const removals = new Set(remove.map((ref) => ref.id))
  const after = new Map(
    (change.type === 'replace' ? [] : before.filter((row) => !removals.has(row.chapter.id))).map(
      (row) => [row.chapter.id, row],
    ),
  )
  for (const row of add) {
    if (!after.has(row.chapter.id)) {
      after.set(row.chapter.id, row)
    }
  }
  if (isDeepStrictEqual(before, [...after.values()])) {
    return
  }
  write.db.delete(members).where(eq(members.volumeId, volume.id)).run()
  let order = 0
  for (const row of after.values()) {
    write.db
      .insert(members)
      .values({
        volumeId: volume.id,
        chapterId: row.chapter.id,
        comicId: part.work.id,
        numberLabel: row.numberLabel,
        sortOrder: order++,
      })
      .run()
  }
  write.changes.push({
    type: 'partUpdated',
    part: volume,
    work: { type: 'comic', id: part.work.id },
  })
}

export function volumeChapterStorage(storage: Storage) {
  return {
    updateVolumeChapter: (
      id: string,
      chapterId: string,
      numberLabel: string | null,
      expected?: { numberLabel: string | null },
    ) =>
      commit(storage, (write) => {
        const where = and(eq(members.volumeId, id), eq(members.chapterId, chapterId)),
          row = write.db.select().from(members).where(where).get()
        if (!row) {
          throw new DesktopError('NotFound', 'The chapter is not in this volume')
        }
        expectFields(row, expected)
        if (row.numberLabel === numberLabel) {
          return
        }
        write.db.update(members).set({ numberLabel }).where(where).run()
        write.changes.push({
          type: 'partUpdated',
          part: { type: 'comicVolume', id },
          work: { type: 'comic', id: row.comicId },
        })
      }),
    orderVolumeChapters: (id: string, input: ReorderInput | MoveInput) =>
      commit(storage, (write) => {
        const ref = { type: 'comicVolume' as const, id },
          volume = requirePart(write.db, ref)
        const current = write.db
          .select({ id: members.chapterId })
          .from(members)
          .where(eq(members.volumeId, id))
          .orderBy(members.sortOrder, members.chapterId)
          .all()
          .map((row) => row.id)
        const order = orderedIds(current, input)
        if (order.every((id, i) => id === current[i])) {
          return
        }
        order.forEach((chapter, i) => {
          if (current[i] !== chapter) {
            write.db
              .update(members)
              .set({ sortOrder: i })
              .where(and(eq(members.volumeId, id), eq(members.chapterId, chapter)))
              .run()
          }
        })
        write.changes.push({
          type: 'partUpdated',
          part: ref,
          work: { type: 'comic', id: volume.work.id },
        })
      }),
  }
}
