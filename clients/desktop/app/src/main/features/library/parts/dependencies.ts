import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { PartRef } from '@kisaki3/desktop-contracts/library'
import { eq } from 'drizzle-orm'
import { isDeepStrictEqual } from 'node:util'
import type { LibraryDatabase } from '../transaction'
import { parts } from './tables'
import { getPart } from './write'

export function partDependents(db: LibraryDatabase, refs: readonly PartRef[]) {
  return refs.map((ref) => {
    const part = getPart(db, ref)
    if (!part) {
      throw new DesktopError('NotFound', 'The selected part no longer exists')
    }
    const links = parts[ref.type].files
    const files = db
      .select({ id: links.fileId })
      .from(links)
      .where(eq(links.partId, ref.id))
      .orderBy(links.fileId)
      .all()
      .map((row) => row.id)
    return { ref, work: part.work, files }
  })
}

export type PartDependents = ReturnType<typeof partDependents>

export function verifyDependents(db: LibraryDatabase, expected: PartDependents) {
  if (
    !isDeepStrictEqual(
      partDependents(
        db,
        expected.map((item) => item.ref),
      ),
      expected,
    )
  ) {
    throw new DesktopError('TargetChanged', 'A part’s work or file associations changed')
  }
}
