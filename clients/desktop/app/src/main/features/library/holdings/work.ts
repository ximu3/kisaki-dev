import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  type ExternalIdentity,
  parseWorkRef,
  type WorkRef,
} from '@kisaki3/desktop-contracts/library'
import type { CallOptions } from '@kisaki3/desktop-contracts/operations'
import { and, eq } from 'drizzle-orm'
import { entries } from '../../../infrastructure/database/schema'
import { findIdentity } from '../entries/external-ids'
import { entryWhere, requireEntry } from '../entries/tables'
import type { LibraryDatabase } from '../transaction'

export function expectOwner(
  db: LibraryDatabase,
  work: WorkRef,
  identities?: readonly ExternalIdentity[],
) {
  requireEntry(db, work)
  for (const identity of identities ?? []) {
    const owner = findIdentity(db, identity)
    if (owner?.id !== work.id || owner.type !== work.type) {
      throw new DesktopError('Conflict', 'The external identity no longer belongs to this work')
    }
  }
}

export function visibleWork(db: LibraryDatabase, work: WorkRef, sensitive: boolean) {
  return !!db
    .select({ id: entries.id })
    .from(entries)
    .where(and(entryWhere(work), sensitive ? undefined : eq(entries.isNsfw, false)))
    .get()
}

export function fileWork(input: unknown) {
  const ref = parseWorkRef(input)
  if (ref.type === 'game') {
    throw new DesktopError('InvalidInput', 'Choose an anime, comic or novel')
  }
  return { type: ref.type, id: ref.id }
}

export const callSignal = (options?: CallOptions) => options?.signal ?? new AbortController().signal
