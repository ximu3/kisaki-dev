import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { and, eq, sql } from 'drizzle-orm'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseWorkCharacterUpdate,
  parsePersonWorkUpdate,
  parseOrganizationWorkUpdate,
  parseWorkRelationUpdate,
} from '@kisaki3/desktop-contracts/library'
import {
  workCharacterLinks as cast,
  workPersonLinks as credits,
  workOrganizationLinks as organizations,
  workRelations as related,
} from '../../../infrastructure/database/schema'
import { requireEntry } from '../entries/tables'
import { expectFields, type LibraryDatabase, type LibraryWrite } from '../transaction'
import { binding, fact, readFact, relationTables, type Relation, type RelationKind } from './facts'

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
export function savedPositions(db: LibraryDatabase, row: Relation): RelationPositions {
  const sides = {
    workCharacter: ['work', 'character'],
    personWork: ['work', 'person', 'character'],
    organizationWork: ['work', 'organization'],
    workRelation: ['from', 'to'],
  }[row.kind]
  const table = relationTables[row.kind]
  const values = db.get<Record<string, string | number | bigint | null>>(
    sql`select * from ${table} where id=${row.value.id}`,
  )!
  const result: RelationPositions = {}
  for (const side of sides) {
    const owner = values[side + '_id'],
      position = values['order_in_' + side]
    if (typeof owner === 'string') {
      result['order_in_' + side] = { owner, position: Number(position) }
    }
  }
  return result
}
function persist(
  write: LibraryWrite,
  row: Relation,
  update: boolean,
  original?: RelationPositions,
) {
  const { db } = write
  function order(
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
        sql`select ${field} position,${owner} owner from ${table} where ${table.id}=${row.value.id}`,
      )
      if (existing?.owner === id) {
        return Number(existing.position)
      }
    }
    return nextPosition(db, table, field, owner, id)
  }
  switch (row.kind) {
    case 'workCharacter': {
      const { work, character, id, role, note, isSpoiler } = row.value
      requireEntry(db, work)
      requireEntry(db, character)
      const fields = {
        workId: work.id,
        workType: work.type,
        characterId: character.id,
        role,
        note,
        isSpoiler,
        orderInWork: order(cast, cast.orderInWork, cast.workId, work.id),
        orderInCharacter: order(cast, cast.orderInCharacter, cast.characterId, character.id),
      }
      if (update) {
        db.update(cast).set(fields).where(eq(cast.id, id)).run()
      } else {
        db.insert(cast)
          .values({ id, ...fields })
          .run()
      }
      break
    }
    case 'personWork': {
      const { work, person, character, id, role, note, isSpoiler } = row.value
      requireEntry(db, work)
      requireEntry(db, person)
      if (character) {
        requireEntry(db, character)
        const exists = db
          .select({ id: cast.id })
          .from(cast)
          .where(and(eq(cast.workId, work.id), eq(cast.characterId, character.id)))
          .get()
        if (!exists) {
          createRelation(write, 'workCharacter', { work, character, role: null })
        }
      }
      const fields = {
        workId: work.id,
        workType: work.type,
        personId: person.id,
        characterId: character?.id ?? null,
        role,
        note,
        isSpoiler,
        orderInWork: order(credits, credits.orderInWork, credits.workId, work.id),
        orderInPerson: order(credits, credits.orderInPerson, credits.personId, person.id),
        orderInCharacter: character
          ? order(credits, credits.orderInCharacter, credits.characterId, character.id)
          : null,
      }
      if (update) {
        db.update(credits).set(fields).where(eq(credits.id, id)).run()
      } else {
        db.insert(credits)
          .values({ id, ...fields })
          .run()
      }
      break
    }
    case 'organizationWork': {
      const { work, organization, id, role, note, isSpoiler } = row.value
      requireEntry(db, work)
      requireEntry(db, organization)
      const fields = {
        workId: work.id,
        workType: work.type,
        organizationId: organization.id,
        role,
        note,
        isSpoiler,
        orderInWork: order(organizations, organizations.orderInWork, organizations.workId, work.id),
        orderInOrganization: order(
          organizations,
          organizations.orderInOrganization,
          organizations.organizationId,
          organization.id,
        ),
      }
      if (update) {
        db.update(organizations).set(fields).where(eq(organizations.id, id)).run()
      } else {
        db.insert(organizations)
          .values({ id, ...fields })
          .run()
      }
      break
    }
    case 'workRelation': {
      const { from, to, type, id, note } = row.value
      requireEntry(db, from)
      requireEntry(db, to)
      const fields = {
        fromId: from.id,
        fromType: from.type,
        toId: to.id,
        toType: to.type,
        type,
        note,
        orderInFrom: order(related, related.orderInFrom, related.fromId, from.id),
        orderInTo: order(related, related.orderInTo, related.toId, to.id),
      }
      if (update) {
        db.update(related).set(fields).where(eq(related.id, id)).run()
      } else {
        db.insert(related)
          .values({ id, ...fields })
          .run()
      }
      break
    }
  }
}

export function saveRelation(
  write: LibraryWrite,
  row: Relation,
  update: boolean,
  original?: RelationPositions,
) {
  try {
    persist(write, row, update, original)
  } catch (cause) {
    if (
      cause instanceof Error &&
      (('code' in cause && cause.code === 'SQLITE_CONSTRAINT_UNIQUE') ||
        (cause.cause instanceof Error &&
          'code' in cause.cause &&
          cause.cause.code === 'SQLITE_CONSTRAINT_UNIQUE'))
    ) {
      throw new DesktopError('Conflict', 'This relationship already exists', { cause })
    }
    throw cause
  }
  write.changes.push({
    type: update || original ? 'relationUpdated' : 'relationCreated',
    relation: binding(row),
  })
}

export function createRelation(write: LibraryWrite, kind: RelationKind, input: unknown) {
  const id = randomUUID()
  saveRelation(write, fact(kind, id, input), false)
  return id
}

export function editedRelation(original: Relation, raw: unknown) {
  const parsers = {
    workCharacter: parseWorkCharacterUpdate,
    personWork: parsePersonWorkUpdate,
    organizationWork: parseOrganizationWorkUpdate,
    workRelation: parseWorkRelationUpdate,
  }
  const { changes, expected } = parsers[original.kind](raw)
  const { note } = original.value
  const isSpoiler = 'isSpoiler' in original.value ? original.value.isSpoiler : undefined
  const endpoints = Object.fromEntries(
    Object.entries(original.value).filter(
      ([key]) => key !== 'id' && key !== 'note' && key !== 'isSpoiler',
    ),
  )
  expectFields({ binding: endpoints, note, isSpoiler }, expected)
  return fact(original.kind, original.value.id, {
    ...endpoints,
    note,
    ...(isSpoiler !== undefined && { isSpoiler }),
    ...changes,
  })
}

export function editRelation(write: LibraryWrite, kind: RelationKind, id: string, raw: unknown) {
  const original = readFact(write.db, kind, id)
  if (!original) {
    throw new DesktopError('NotFound', 'The relationship does not exist')
  }
  const next = editedRelation(original, raw)
  if (isDeepStrictEqual(next, original)) {
    return
  }

  if (
    original.kind === 'workCharacter' &&
    next.kind === 'workCharacter' &&
    (original.value.work.id !== next.value.work.id ||
      original.value.character.id !== next.value.character.id)
  ) {
    const depends = write.db
      .select({ id: credits.id })
      .from(credits)
      .where(
        and(
          eq(credits.workId, original.value.work.id),
          eq(credits.characterId, original.value.character.id),
        ),
      )
      .limit(1)
      .get()
    if (depends) {
      throw new DesktopError(
        'Conflict',
        'Move or remove the dependent character credits explicitly',
      )
    }
  }
  saveRelation(write, next, true)
}

export function removeRelation(write: LibraryWrite, kind: RelationKind, id: string) {
  const row = readFact(write.db, kind, id)
  if (!row) {
    throw new DesktopError('NotFound', 'The relationship does not exist')
  }
  if (row.kind === 'workCharacter') {
    const work = write.db
      .select({ id: credits.id })
      .from(credits)
      .where(
        and(eq(credits.workId, row.value.work.id), eq(credits.characterId, row.value.character.id)),
      )
      .all()
    for (const item of work) {
      const lost = readFact(write.db, 'personWork', item.id)!
      write.changes.push({ type: 'relationDeleted', relation: binding(lost) })
    }
  }
  const table = relationTables[kind]
  write.db.delete(table).where(eq(table.id, id)).run()
  write.changes.push({ type: 'relationDeleted', relation: binding(row) })
}
