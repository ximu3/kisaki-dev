import { tagNameKey, type OrganizerMerge } from '@kisaki3/desktop-contracts/library'
import { and, eq } from 'drizzle-orm'
import type { Storage } from '../../../infrastructure/database'
import { collections, tags } from '../../../infrastructure/database/schema'
import { redirectShowcaseQueries } from '../showcase/queries'
import { mergeText } from '../text'
import { commit } from '../transaction'
import {
  changeCollectionMembers,
  readCollectionMembers,
  requireManualCollection,
} from './collections/memberships'
import { redirectCollectionRules } from './collections/rules'
import { storeDescription } from './description'
import {
  changeTagEntries,
  keepMergedTagPositions,
  readTagEntries,
  requireTag,
} from './tags/applications'

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
    mergeOrganizers: (kind: 'tag' | 'collection', input: OrganizerMerge) =>
      commit(storage, (write) => {
        const { db } = write
        const requireOrganizer = kind === 'collection' ? requireManualCollection : requireTag
        const readMembers = kind === 'collection' ? readCollectionMembers : readTagEntries
        const { sourceIds, targetId } = input,
          kept = requireOrganizer(db, targetId)
        const sources = sourceIds.map((id) => requireOrganizer(db, id))
        let desc = kept.description,
          cover = 'primaryImageId' in kept ? kept.primaryImageId : null
        const desired = new Map(readMembers(db, targetId).items.map((row) => [row.entry.id, row]))
        const original = new Set(desired.keys())
        for (const source of sources) {
          desc ||= source.description
          if (!cover && 'primaryImageId' in source) {
            cover = source.primaryImageId
          }
          for (const row of readMembers(db, source.id).items) {
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
        const change = { type: 'replace', items: [...desired.values()] } as const
        if (kind === 'collection') {
          changeCollectionMembers(write, targetId, change)
        } else {
          changeTagEntries(write, targetId, change)
        }
        if (kind === 'tag') {
          keepMergedTagPositions(db, sourceIds, targetId, desired.keys(), original)
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
          redirectCollectionRules(
            write,
            { type: kind, id: row.id },
            { type: kind, id: targetId },
            kept.name,
          )
          redirectShowcaseQueries(
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
