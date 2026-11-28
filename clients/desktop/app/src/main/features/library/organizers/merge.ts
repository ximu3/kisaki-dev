import { and, eq, inArray, min } from 'drizzle-orm'
import { tagNameKey, type OrganizerMerge } from '@kisaki3/desktop-contracts/library'
import { collections, tags, entryTags } from '../../../infrastructure/database/schema'
import type { Storage } from '../../../infrastructure/database'
import { commit } from '../transaction'
import { redirectQueries } from '../entries/identity/queries'
import { mergeText } from '../entries/identity/fields'
import { organizerMembers, replaceMembers, requireOrganizer, type Organizer } from './members'
import { storeDescription } from './description'

export function organizerMergeStorage(storage: Storage) {
  return {
    findTagByName: (name: string, sensitive: boolean) =>
      storage.db
        .select()
        .from(tags)
        .where(
          and(eq(tags.nameKey, tagNameKey(name)), sensitive ? undefined : eq(tags.isNsfw, false)),
        )
        .get() ?? null,
    mergeOrganizers: (kind: Organizer, input: OrganizerMerge) =>
      commit(storage, (write) => {
        const { db } = write,
          { sourceIds, targetId } = input,
          kept = requireOrganizer(db, kind, targetId)
        const sources = sourceIds.map((id) => requireOrganizer(db, kind, id))
        let desc = kept.description,
          cover = 'primaryImageId' in kept ? kept.primaryImageId : null
        const desired = new Map(
          organizerMembers(db, kind, targetId).items.map((row) => [row.entry.id, row]),
        )
        const original = new Set(desired.keys())
        for (const source of sources) {
          desc ||= source.description
          if (!cover && 'primaryImageId' in source) {
            cover = source.primaryImageId
          }
          for (const row of organizerMembers(db, kind, source.id).items) {
            const before = desired.get(row.entry.id)
            desired.set(
              row.entry.id,
              before
                ? {
                    ...before,
                    note: mergeText(before.note, row.note),
                    ...('isSpoiler' in row &&
                      'isSpoiler' in before && { isSpoiler: row.isSpoiler || before.isSpoiler }),
                  }
                : row,
            )
          }
        }
        replaceMembers(write, kind, targetId, { type: 'replace', items: [...desired.values()] })
        if (kind === 'tag') {
          for (const entryId of desired.keys()) {
            if (!original.has(entryId)) {
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
        if (desc !== kept.description) {
          storeDescription(write, kind, targetId, desc)
        }
        if (
          kind === 'collection' &&
          'primaryImageId' in kept &&
          (desc !== kept.description || cover !== kept.primaryImageId)
        ) {
          db.update(collections)
            .set({ primaryImageId: cover, description: desc, updatedAt: write.now })
            .where(eq(collections.id, targetId))
            .run()
        }
        if (kind === 'tag' && desc !== kept.description) {
          db.update(tags)
            .set({ description: desc, updatedAt: write.now })
            .where(eq(tags.id, targetId))
            .run()
        }
        const table = kind === 'tag' ? tags : collections
        for (const row of sources) {
          redirectQueries(
            write,
            { type: kind, id: row.id },
            { type: kind, id: targetId },
            kept.name,
          )
          storeDescription(write, kind, row.id, null)
          if ('primaryImageId' in row && row.primaryImageId) {
            write.released.add(row.primaryImageId)
          }
          db.delete(table).where(eq(table.id, row.id)).run()
        }
        write.changes.push(
          kind === 'tag'
            ? { type: 'tagsMerged', sourceIds, targetId }
            : { type: 'collectionsMerged', sourceIds, targetId },
        )
        return { targetId, removedIds: sourceIds }
      }),
  }
}
