import type {
  OrganizationWork,
  OrganizationWorkCreate,
  OrganizationWorkScope,
  OrganizationWorkUpdate,
  PersonWork,
  PersonWorkCreate,
  PersonWorkScope,
  PersonWorkUpdate,
  RelationsApi,
  ReorderInput,
  WorkCharacter,
  WorkCharacterCreate,
  WorkCharacterScope,
  WorkCharacterUpdate,
  WorkRelation,
  WorkRelationCreate,
  WorkRelationScope,
  WorkRelationUpdate,
} from '@kisaki3/desktop-contracts/library'
import type { ListOptions, ListResult } from '@kisaki3/desktop-contracts/operations'

export type RelationFamily = keyof RelationsApi

export type LibraryFact = WorkCharacter | PersonWork | OrganizationWork | WorkRelation

export type LibraryRelationScope =
  | WorkCharacterScope
  | PersonWorkScope
  | OrganizationWorkScope
  | WorkRelationScope

export interface RelationWindowApi {
  'library.relations.list'(
    family: RelationFamily,
    scope: LibraryRelationScope,
    range: ListOptions,
    spoilers: boolean,
  ): ListResult<LibraryFact>
  'library.relations.get'(family: RelationFamily, id: string, spoilers: boolean): LibraryFact | null
  'library.relations.create'(
    family: RelationFamily,
    input: WorkCharacterCreate | PersonWorkCreate | OrganizationWorkCreate | WorkRelationCreate,
  ): string
  'library.relations.update'(
    family: RelationFamily,
    id: string,
    input: WorkCharacterUpdate | PersonWorkUpdate | OrganizationWorkUpdate | WorkRelationUpdate,
  ): void
  'library.relations.delete'(family: RelationFamily, id: string): void
  'library.relations.reorder'(
    family: RelationFamily,
    scope: LibraryRelationScope,
    input: ReorderInput,
  ): void
}
