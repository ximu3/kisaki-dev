import { sql } from 'drizzle-orm'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import type {
  workCharacterLinks as cast,
  workPersonLinks as credits,
  workOrganizationLinks as organizations,
  workRelations as related,
} from '../../../infrastructure/database/schema'
import type { LibraryDatabase } from '../transaction'

function nextPosition(
  db: LibraryDatabase,
  table: typeof cast | typeof credits | typeof organizations | typeof related,
  order: AnySQLiteColumn,
  scope: AnySQLiteColumn,
  id: string,
) {
  return Number(
    db.get<{ n: number | bigint }>(
      sql`select coalesce(max(${order}),-1)+1 n from ${table} where ${scope}=${id}`,
    )!.n,
  )
}

export type RelationPositions = Record<string, { owner: string; position: number }>

export function relationOrder(
  db: LibraryDatabase,
  relationId: string,
  update: boolean,
  original?: RelationPositions,
) {
  return function order(
    table: typeof cast | typeof credits | typeof organizations | typeof related,
    field: AnySQLiteColumn,
    owner: AnySQLiteColumn,
    id: string,
  ) {
    const saved = original?.[field.name]
    if (saved?.owner === id) {
      return saved.position
    }
    if (update) {
      const existing = db.get<{ position: bigint | number; owner: string }>(
        sql`select ${field} position,${owner} owner from ${table} where ${table.id}=${relationId}`,
      )
      if (existing?.owner === id) {
        return Number(existing.position)
      }
    }
    return nextPosition(db, table, field, owner, id)
  }
}

export type RelationOrder = ReturnType<typeof relationOrder>
