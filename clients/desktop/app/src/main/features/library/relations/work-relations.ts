import { eq, sql } from 'drizzle-orm'
import {
  normalizeWorkRelation,
  parseWorkRelationCreate,
  type WorkRelation,
} from '@kisaki3/desktop-contracts/library'
import { workRelations } from '../../../infrastructure/database/schema'
import type { LibraryDatabase, LibraryWrite } from '../transaction'
import { requireEntry } from '../entries/tables'
import type { RelationOrder } from './order'

export const table = workRelations
export const sides = ['from', 'to'] as const

export function fact(id: string, raw: unknown): { kind: 'workRelation'; value: WorkRelation } {
  const { note, ...binding } = parseWorkRelationCreate(raw)
  return {
    kind: 'workRelation',
    value: { ...normalizeWorkRelation(binding), id, note: note ?? null },
  }
}

export function read(db: LibraryDatabase, id: string): ReturnType<typeof fact> | null {
  const r = db.select().from(workRelations).where(eq(workRelations.id, id)).get()
  return r
    ? {
        kind: 'workRelation',
        value: {
          id: r.id,
          from: { type: r.fromType, id: r.fromId },
          to: { type: r.toType, id: r.toId },
          type: r.type,
          note: r.note,
        },
      }
    : null
}

export function snapshot({ id, from, to, type }: WorkRelation) {
  return { type: 'workRelation', id, binding: { from, to, type } } as const
}

export function find(db: LibraryDatabase, value: WorkRelation) {
  const where = sql`from_id=${value.from.id} and to_id=${value.to.id} and type=${value.type}`
  return db.get<{ id: string }>(sql`select id from ${workRelations} where ${where}`)?.id
}

export function persist(
  write: LibraryWrite,
  value: WorkRelation,
  update: boolean,
  order: RelationOrder,
) {
  const { db } = write
  const { from, to, type, id, note } = value
  requireEntry(db, from)
  requireEntry(db, to)
  const fields = {
    fromId: from.id,
    fromType: from.type,
    toId: to.id,
    toType: to.type,
    type,
    note,
    orderInFrom: order(workRelations, workRelations.orderInFrom, workRelations.fromId, from.id),
    orderInTo: order(workRelations, workRelations.orderInTo, workRelations.toId, to.id),
  }
  if (update) {
    db.update(workRelations).set(fields).where(eq(workRelations.id, id)).run()
  } else {
    db.insert(workRelations)
      .values({ id, ...fields })
      .run()
  }
}
