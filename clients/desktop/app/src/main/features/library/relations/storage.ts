import { isDeepStrictEqual } from 'node:util'
import { sql } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseEntryRef,
  parseWorkRef,
  type EntryRef,
  type ReorderInput,
  type MoveInput,
} from '@kisaki3/desktop-contracts/library'
import type { ListOptions } from '@kisaki3/desktop-contracts/operations'
import type { Storage } from '../../../infrastructure/database'
import { commit, type LibraryDatabase } from '../transaction'
import { requireEntry } from '../entries/tables'
import { families, binding, readFact, relationTables, type RelationKind } from './facts'
import { createRelation, editRelation, removeRelation } from './write'

type Side = 'work' | 'person' | 'character' | 'organization' | 'from' | 'to'
export interface RelationScope {
  kind: RelationKind
  side: Side
  entry: EntryRef
}

export function readScope(kind: RelationKind, raw: unknown): RelationScope {
  if (
    !raw ||
    typeof raw !== 'object' ||
    !('side' in raw) ||
    typeof raw.side !== 'string' ||
    !(families[kind].sides as readonly string[]).includes(raw.side) ||
    Object.keys(raw).length !== 2
  ) {
    throw new DesktopError('InvalidInput', 'Invalid relationship scope')
  }
  const side = raw.side as Side
  const entry =
    side === 'from' || side === 'to' || side === 'work'
      ? parseWorkRef(Reflect.get(raw, 'work'))
      : parseEntryRef({ type: side, id: Reflect.get(raw, side + 'Id') as unknown })
  return { kind, side, entry }
}

function visibility(kind: RelationKind, sensitive: boolean, spoilers: boolean) {
  const clauses = []
  if (kind !== 'workRelation' && !spoilers) {
    clauses.push(sql`not l.is_spoiler`)
  }
  if (!sensitive) {
    for (const side of families[kind].sides) {
      const id = sql`l.${sql.identifier(side + '_id')}`
      clauses.push(
        sql`not exists(select 1 from entries other where other.id=${id} and other.is_nsfw)`,
      )
    }
  }
  if (kind === 'personWork' && !spoilers) {
    clauses.push(
      sql`not exists(select 1 from work_character_links c where c.work_id=l.work_id and c.character_id=l.character_id and c.is_spoiler)`,
    )
  }
  return clauses.length ? sql.join(clauses, sql` and `) : sql`1`
}

function sideRows(scope: RelationScope) {
  return {
    table: relationTables[scope.kind],
    owner: sql.identifier(scope.side + '_id'),
    position: sql.identifier('order_in_' + scope.side),
  }
}

export function listFacts(
  db: LibraryDatabase,
  scope: RelationScope,
  range: ListOptions,
  sensitive: boolean,
  spoilers: boolean,
) {
  requireEntry(db, scope.entry)
  const { table, owner, position } = sideRows(scope)
  const from = sql`from ${table} l where l.${owner}=${scope.entry.id} and ${visibility(scope.kind, sensitive, spoilers)}`
  const ids = db.all<{ id: string }>(
    sql`select id ${from} order by l.${position},l.id limit ${range.limit} offset ${range.offset}`,
  )
  return {
    total: Number(db.get<{ n: bigint }>(sql`select count(*) n ${from}`)!.n),
    items: ids.map((row) => readFact(db, scope.kind, row.id)!.value),
  }
}

export function relationStorage(storage: Storage) {
  return {
    listFacts: (scope: RelationScope, range: ListOptions, sensitive: boolean, spoilers: boolean) =>
      storage.transaction((db) => listFacts(db, scope, range, sensitive, spoilers)),
    readVisibleFact: (kind: RelationKind, id: string, sensitive: boolean, spoilers: boolean) =>
      storage.transaction((db) =>
        db.get(
          sql`select 1 from ${relationTables[kind]} l where l.id=${id} and ${visibility(kind, sensitive, spoilers)}`,
        )
          ? readFact(db, kind, id)!.value
          : null,
      ),
    createFact: (kind: RelationKind, input: unknown) =>
      commit(storage, (write) => createRelation(write, kind, input)),
    editFact: (kind: RelationKind, id: string, input: unknown) =>
      commit(storage, (write) => editRelation(write, kind, id, input)),
    deleteFact: (kind: RelationKind, id: string) =>
      commit(storage, (write) => removeRelation(write, kind, id)),
    arrangeFacts(scope: RelationScope, input: ReorderInput | MoveInput) {
      return commit(storage, (write) => {
        requireEntry(write.db, scope.entry)
        const { table, owner, position } = sideRows(scope)
        const ids = write.db
          .all<{ id: string }>(
            sql`select id from ${table} where ${owner}=${scope.entry.id} order by ${position},id`,
          )
          .map((row) => row.id)
        const selected = new Set('order' in input ? input.order : input.ids)
        if ([...selected].some((id) => !ids.includes(id))) {
          throw new DesktopError('Conflict', 'The relationship scope has changed')
        }
        let order: string[]
        if ('order' in input) {
          if (!isDeepStrictEqual(ids, input.expected.order)) {
            throw new DesktopError('Conflict', 'The relationship order has changed')
          }
          let slot = 0
          order = ids.map((id) => (selected.has(id) ? input.order[slot++]! : id))
        } else {
          order = ids.filter((id) => !selected.has(id))
          const index = input.before === null ? order.length : order.indexOf(input.before)
          if (index < 0) {
            throw new DesktopError('Conflict', 'The selected neighbour has changed')
          }
          order.splice(index, 0, ...input.ids)
        }
        if (isDeepStrictEqual(order, ids)) {
          return
        }
        for (const [index, id] of order.entries()) {
          write.db.run(sql`update ${table} set ${position}=${index} where id=${id}`)
          if (ids[index] !== id) {
            write.changes.push({
              type: 'relationUpdated',
              relation: binding(readFact(write.db, scope.kind, id)!),
            })
          }
        }
      })
    },
  }
}
