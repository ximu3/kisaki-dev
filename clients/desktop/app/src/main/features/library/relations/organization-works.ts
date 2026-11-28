import { eq, sql } from 'drizzle-orm'
import {
  parseOrganizationWorkCreate,
  type OrganizationWork,
} from '@kisaki3/desktop-contracts/library'
import { workOrganizationLinks } from '../../../infrastructure/database/schema'
import type { LibraryDatabase, LibraryWrite } from '../transaction'
import { requireEntry } from '../entries/tables'
import type { RelationOrder } from './order'

export const table = workOrganizationLinks
export const sides = ['work', 'organization'] as const

export function fact(
  id: string,
  raw: unknown,
): { kind: 'organizationWork'; value: OrganizationWork } {
  return {
    kind: 'organizationWork',
    value: { note: null, isSpoiler: false, ...parseOrganizationWorkCreate(raw), id },
  }
}

export function read(db: LibraryDatabase, id: string): ReturnType<typeof fact> | null {
  const r = db.select().from(workOrganizationLinks).where(eq(workOrganizationLinks.id, id)).get()
  return r
    ? fact(id, {
        work: { id: r.workId, type: r.workType },
        organization: { type: 'organization', id: r.organizationId },
        role: r.role,
        note: r.note,
        isSpoiler: r.isSpoiler,
      })
    : null
}

export function snapshot(value: OrganizationWork) {
  const binding = { ...value }
  Reflect.deleteProperty(binding, 'note')
  Reflect.deleteProperty(binding, 'isSpoiler')
  return { type: 'organizationWork', ...binding } as const
}

export function find(db: LibraryDatabase, value: OrganizationWork) {
  const where = sql`work_id=${value.work.id} and organization_id=${value.organization.id} and role=${value.role}`
  return db.get<{ id: string }>(sql`select id from ${workOrganizationLinks} where ${where}`)?.id
}

export function persist(
  write: LibraryWrite,
  value: OrganizationWork,
  update: boolean,
  order: RelationOrder,
) {
  const { db } = write
  const { work, organization, id, role, note, isSpoiler } = value
  requireEntry(db, work)
  requireEntry(db, organization)
  const fields = {
    workId: work.id,
    workType: work.type,
    organizationId: organization.id,
    role,
    note,
    isSpoiler,
    orderInWork: order(
      workOrganizationLinks,
      workOrganizationLinks.orderInWork,
      workOrganizationLinks.workId,
      work.id,
    ),
    orderInOrganization: order(
      workOrganizationLinks,
      workOrganizationLinks.orderInOrganization,
      workOrganizationLinks.organizationId,
      organization.id,
    ),
  }
  if (update) {
    db.update(workOrganizationLinks).set(fields).where(eq(workOrganizationLinks.id, id)).run()
  } else {
    db.insert(workOrganizationLinks)
      .values({ id, ...fields })
      .run()
  }
}
