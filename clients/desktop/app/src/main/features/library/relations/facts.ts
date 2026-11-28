import { eq, sql } from 'drizzle-orm'
import {
  normalizeWorkRelation,
  parseWorkCharacterCreate,
  parsePersonWorkCreate,
  parseOrganizationWorkCreate,
  parseWorkRelationCreate,
  type WorkCharacter,
  type PersonWork,
  type OrganizationWork,
  type WorkRelation,
} from '@kisaki3/desktop-contracts/library'
import {
  workCharacterLinks,
  workPersonLinks,
  workOrganizationLinks,
  workRelations,
} from '../../../infrastructure/database/schema'
import type { LibraryDatabase } from '../transaction'

export type Relation =
  | { kind: 'workCharacter'; value: WorkCharacter }
  | { kind: 'personWork'; value: PersonWork }
  | { kind: 'organizationWork'; value: OrganizationWork }
  | { kind: 'workRelation'; value: WorkRelation }
export type RelationKind = Relation['kind']
export const relationTables = {
  workCharacter: workCharacterLinks,
  personWork: workPersonLinks,
  organizationWork: workOrganizationLinks,
  workRelation: workRelations,
}

export function fact(kind: RelationKind, id: string, raw: unknown): Relation {
  switch (kind) {
    case 'workCharacter':
      return { kind, value: { note: null, isSpoiler: false, ...parseWorkCharacterCreate(raw), id } }
    case 'personWork':
      return { kind, value: { note: null, isSpoiler: false, ...parsePersonWorkCreate(raw), id } }
    case 'organizationWork':
      return {
        kind,
        value: { note: null, isSpoiler: false, ...parseOrganizationWorkCreate(raw), id },
      }
    case 'workRelation': {
      const { note, ...binding } = parseWorkRelationCreate(raw)
      return { kind, value: { ...normalizeWorkRelation(binding), id, note: note ?? null } }
    }
  }
}

export function readFact(db: LibraryDatabase, kind: RelationKind, id: string): Relation | null {
  switch (kind) {
    case 'workCharacter': {
      const r = db.select().from(workCharacterLinks).where(eq(workCharacterLinks.id, id)).get()
      return r
        ? {
            kind,
            value: {
              id: r.id,
              work: { id: r.workId, type: r.workType },
              character: { type: 'character', id: r.characterId },
              role: r.role,
              note: r.note,
              isSpoiler: r.isSpoiler,
            },
          }
        : null
    }
    case 'personWork': {
      const r = db.select().from(workPersonLinks).where(eq(workPersonLinks.id, id)).get()
      return r
        ? fact(kind, id, {
            work: { id: r.workId, type: r.workType },
            person: { type: 'person', id: r.personId },
            character: r.characterId ? { type: 'character', id: r.characterId } : null,
            role: r.role,
            note: r.note,
            isSpoiler: r.isSpoiler,
          })
        : null
    }
    case 'organizationWork': {
      const r = db
        .select()
        .from(workOrganizationLinks)
        .where(eq(workOrganizationLinks.id, id))
        .get()
      return r
        ? fact(kind, id, {
            work: { id: r.workId, type: r.workType },
            organization: { type: 'organization', id: r.organizationId },
            role: r.role,
            note: r.note,
            isSpoiler: r.isSpoiler,
          })
        : null
    }
    case 'workRelation': {
      const r = db.select().from(workRelations).where(eq(workRelations.id, id)).get()
      return r
        ? {
            kind,
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
  }
}

export function binding(row: Relation) {
  if (row.kind === 'workRelation') {
    const { from, to, type } = row.value
    return { type: row.kind, id: row.value.id, binding: { from, to, type } } as const
  }
  if (row.kind === 'workCharacter') {
    const { work, character, role, id } = row.value
    return { type: row.kind, id, work, character, role } as const
  }
  if (row.kind === 'personWork') {
    const value = { ...row.value }
    Reflect.deleteProperty(value, 'note')
    Reflect.deleteProperty(value, 'isSpoiler')
    return { type: row.kind, ...value } as const
  }
  const value = { ...row.value }
  Reflect.deleteProperty(value, 'note')
  Reflect.deleteProperty(value, 'isSpoiler')
  return { type: row.kind, ...value } as const
}
export function findRelation(db: LibraryDatabase, row: Relation) {
  let where
  switch (row.kind) {
    case 'workCharacter':
      where = sql`work_id=${row.value.work.id} and character_id=${row.value.character.id}`
      break
    case 'personWork':
      where = sql`work_id=${row.value.work.id} and person_id=${row.value.person.id} and character_id is ${row.value.character?.id ?? null} and role=${row.value.role}`
      break
    case 'organizationWork':
      where = sql`work_id=${row.value.work.id} and organization_id=${row.value.organization.id} and role=${row.value.role}`
      break
    case 'workRelation':
      where = sql`from_id=${row.value.from.id} and to_id=${row.value.to.id} and type=${row.value.type}`
      break
  }
  return db.get<{ id: string }>(sql`select id from ${relationTables[row.kind]} where ${where}`)?.id
}
