import type { LibraryDatabase } from '../transaction'
import * as workCharacters from './work-characters'
import * as personWorks from './person-works'
import * as organizationWorks from './organization-works'
import * as workRelations from './work-relations'

export type Relation = ReturnType<
  | typeof workCharacters.fact
  | typeof personWorks.fact
  | typeof organizationWorks.fact
  | typeof workRelations.fact
>
export type RelationKind = Relation['kind']
export const relationTables = {
  workCharacter: workCharacters.table,
  personWork: personWorks.table,
  organizationWork: organizationWorks.table,
  workRelation: workRelations.table,
}

export const families = {
  workCharacter: workCharacters,
  personWork: personWorks,
  organizationWork: organizationWorks,
  workRelation: workRelations,
} as const

export function fact(kind: RelationKind, id: string, raw: unknown): Relation {
  return families[kind].fact(id, raw)
}

export function readFact(db: LibraryDatabase, kind: RelationKind, id: string): Relation | null {
  return families[kind].read(db, id)
}

export function binding(row: Relation) {
  switch (row.kind) {
    case 'workCharacter':
      return workCharacters.snapshot(row.value)
    case 'personWork':
      return personWorks.snapshot(row.value)
    case 'organizationWork':
      return organizationWorks.snapshot(row.value)
    case 'workRelation':
      return workRelations.snapshot(row.value)
  }
}

export function findRelation(db: LibraryDatabase, row: Relation) {
  switch (row.kind) {
    case 'workCharacter':
      return workCharacters.find(db, row.value)
    case 'personWork':
      return personWorks.find(db, row.value)
    case 'organizationWork':
      return organizationWorks.find(db, row.value)
    case 'workRelation':
      return workRelations.find(db, row.value)
  }
}
