import { parseDynamicRules } from '@kisaki3/desktop-contracts/library'
import { eq } from 'drizzle-orm'
import { ready } from '../../../../infrastructure/database/codecs/json'
import { collections } from '../../../../infrastructure/database/schema'
import { type QueryTarget, replaceQueryReference } from '../../query-references'
import type { LibraryWrite } from '../../transaction'

export function redirectCollectionRules(
  write: LibraryWrite,
  from: QueryTarget,
  to: QueryTarget,
  name: string,
) {
  const { db } = write
  for (const row of db
    .select({ id: collections.id, rules: collections.dynamicRules })
    .from(collections)
    .where(eq(collections.membershipMode, 'dynamic'))
    .all()) {
    if (row.rules?.status !== 'ready') {
      continue
    }
    const next = replaceQueryReference(row.rules.value, from, to, name)
    if (next === row.rules.value) {
      continue
    }
    db.update(collections)
      .set({ dynamicRules: ready(parseDynamicRules(next)), updatedAt: write.now })
      .where(eq(collections.id, row.id))
      .run()
    write.changes.push({ type: 'collectionUpdated', collectionId: row.id })
  }
}
