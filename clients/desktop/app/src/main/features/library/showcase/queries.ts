import { parseShowcaseQuery } from '@kisaki3/desktop-contracts/library'
import { eq } from 'drizzle-orm'
import { ready } from '../../../infrastructure/database/codecs/json'
import { showcaseSections } from '../../../infrastructure/database/schema'
import { type QueryTarget, replaceQueryReference } from '../query-references'
import type { LibraryWrite } from '../transaction'

export function redirectShowcaseQueries(
  write: LibraryWrite,
  from: QueryTarget,
  to: QueryTarget,
  name: string,
) {
  const { db } = write
  for (const row of db
    .select({ id: showcaseSections.id, query: showcaseSections.query })
    .from(showcaseSections)
    .all()) {
    if (row.query.status !== 'ready') {
      continue
    }
    const next = replaceQueryReference(row.query.value, from, to, name)
    if (next === row.query.value) {
      continue
    }
    db.update(showcaseSections)
      .set({ query: ready(parseShowcaseQuery(next)), updatedAt: write.now })
      .where(eq(showcaseSections.id, row.id))
      .run()
    write.changes.push({ type: 'showcaseChanged', sectionIds: [row.id] })
  }
}
