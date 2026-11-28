import { and, eq } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { ExternalIdentity } from '@kisaki3/desktop-contracts/library'
import {
  entries,
  entryExternalIdentities as identities,
} from '../../../infrastructure/database/schema'
import type { LibraryDatabase } from '../transaction'

function identityWhere(identity: ExternalIdentity) {
  return and(eq(identities.source, identity.source), eq(identities.sourceId, identity.sourceId))
}

export function findIdentity(db: LibraryDatabase, identity: ExternalIdentity) {
  return (
    db
      .select({ type: entries.type, id: entries.id })
      .from(identities)
      .innerJoin(entries, eq(entries.id, identities.ownerId))
      .where(identityWhere(identity))
      .get() ?? null
  )
}

export function readIdentities(db: LibraryDatabase, id: string) {
  return db
    .select({ source: identities.source, sourceId: identities.sourceId })
    .from(identities)
    .where(eq(identities.ownerId, id))
    .orderBy(identities.source, identities.sourceId)
    .all()
}

export function bindIdentity(db: LibraryDatabase, id: string, identity: ExternalIdentity) {
  const owner = findIdentity(db, identity)
  if (owner && owner.id !== id) {
    throw new DesktopError('Conflict', 'The external identity belongs to another entry')
  }
  if (owner) {
    return false
  }
  db.insert(identities)
    .values({ ...identity, ownerId: id })
    .run()
  return true
}

export function unbindIdentity(db: LibraryDatabase, id: string, identity: ExternalIdentity) {
  return (
    db
      .delete(identities)
      .where(and(eq(identities.ownerId, id), identityWhere(identity)))
      .run().changes > 0
  )
}
