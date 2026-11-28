import { eq } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { Storage } from '../../../infrastructure/database'
import { collections, tags } from '../../../infrastructure/database/schema'
import { commit } from '../transaction'
import { collectionStorage } from './collections/storage'
import { tagStorage } from './tags/storage'
import { storeDescription } from './description'
import { organizerMemberStorage } from './members/storage'
import { organizerMergeStorage } from './merge'

export function organizerStorage(storage: Storage) {
  return {
    ...collectionStorage(storage),
    ...tagStorage(storage),
    ...organizerMemberStorage(storage),
    ...organizerMergeStorage(storage),
    deleteOrganizer(kind: 'collection' | 'tag', id: string) {
      return commit(storage, (write) => {
        const { db } = write
        const table = kind === 'tag' ? tags : collections
        const row = db.select().from(table).where(eq(table.id, id)).get()
        if (!row) {
          throw new DesktopError('NotFound', 'The selected library item no longer exists')
        }
        storeDescription(write, kind, id, null)
        if ('primaryImageId' in row && row.primaryImageId) {
          write.released.add(row.primaryImageId)
        }
        db.delete(table).where(eq(table.id, id)).run()
        write.changes.push(
          kind === 'tag'
            ? { type: 'tagDeleted', tagId: id, name: row.name }
            : { type: 'collectionDeleted', collectionId: id, name: row.name },
        )
      })
    },
  }
}
