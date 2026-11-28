import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { eq, sql } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseWorkCharacterUpdate,
  parsePersonWorkUpdate,
  parseOrganizationWorkUpdate,
  parseWorkRelationUpdate,
} from '@kisaki3/desktop-contracts/library'
import { expectFields, type LibraryDatabase, type LibraryWrite } from '../transaction'
import {
  binding,
  fact,
  readFact,
  relationTables,
  type Relation,
  type RelationKind,
  families,
} from './facts'
import { relationOrder, type RelationPositions } from './order'
import * as workCharacters from './work-characters'
import * as personWorks from './person-works'
import * as organizationWorks from './organization-works'
import * as workRelations from './work-relations'

export function savedPositions(db: LibraryDatabase, row: Relation): RelationPositions {
  const sides = families[row.kind].sides
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
  const order = relationOrder(write.db, row.value.id, update, original)
  switch (row.kind) {
    case 'workCharacter':
      return workCharacters.persist(write, row.value, update, order)
    case 'personWork':
      return personWorks.persist(write, row.value, update, order, (work, character) => {
        createRelation(write, 'workCharacter', { work, character, role: null })
      })
    case 'organizationWork':
      return organizationWorks.persist(write, row.value, update, order)
    case 'workRelation':
      return workRelations.persist(write, row.value, update, order)
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

  if (original.kind === 'workCharacter' && next.kind === 'workCharacter') {
    workCharacters.checkCreditBindings(write.db, original.value, next.value)
  }
  saveRelation(write, next, true)
}

export function removeRelation(write: LibraryWrite, kind: RelationKind, id: string) {
  const row = readFact(write.db, kind, id)
  if (!row) {
    throw new DesktopError('NotFound', 'The relationship does not exist')
  }
  if (row.kind === 'workCharacter') {
    personWorks.recordRemovedCredits(write, row.value)
  }
  const table = relationTables[kind]
  write.db.delete(table).where(eq(table.id, id)).run()
  write.changes.push({ type: 'relationDeleted', relation: binding(row) })
}
