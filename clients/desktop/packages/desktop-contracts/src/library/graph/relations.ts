/** @fileoverview Defines graph relation edits and their shared action schemas. */

import type { GraphEntryRef, GraphPartRef, GraphTagChange } from './nodes'
import type { WorkType, EntryTag } from '../catalog'
import type {
  CharacterRole,
  PersonRole,
  OrganizationRole,
  WorkRelationType,
  WorkCharacterUpdate,
  PersonWorkUpdate,
  OrganizationWorkUpdate,
  WorkRelationUpdate,
  WorkCharacterBinding,
  PersonWorkBinding,
  OrganizationWorkBinding,
  StoredWorkRelationBinding,
} from '../relations'
import type { VolumeChapter } from '../parts'
import * as v from 'valibot'
import { text, id, optionalFields, validateExpectedKeys, unique } from '../../validation'

export interface GraphWorkCharacterAdd {
  readonly work: GraphEntryRef<WorkType>
  readonly character: GraphEntryRef<'character'>
  readonly role: CharacterRole | null
  readonly note?: string | null
  readonly isSpoiler?: boolean
}

export interface GraphPersonWorkAdd {
  readonly work: GraphEntryRef<WorkType>
  readonly person: GraphEntryRef<'person'>
  readonly character: GraphEntryRef<'character'> | null
  readonly role: PersonRole
  readonly note?: string | null
  readonly isSpoiler?: boolean
}

export interface GraphOrganizationWorkAdd {
  readonly work: GraphEntryRef<WorkType>
  readonly organization: GraphEntryRef<'organization'>
  readonly role: OrganizationRole
  readonly note?: string | null
  readonly isSpoiler?: boolean
}

export interface GraphWorkRelationAdd {
  readonly from: GraphEntryRef<WorkType>
  readonly to: GraphEntryRef<WorkType>
  readonly type: WorkRelationType
  readonly note?: string | null
}

/** Update preserves a real relation ID; only new endpoints may use graph keys, while baselines are complete saved facts. */
export interface GraphWorkCharacterUpdate {
  readonly id: string
  readonly changes: Partial<GraphWorkCharacterAdd>
  readonly expected?: NonNullable<WorkCharacterUpdate['expected']>
}

export interface GraphPersonWorkUpdate {
  readonly id: string
  readonly changes: Partial<GraphPersonWorkAdd>
  readonly expected?: NonNullable<PersonWorkUpdate['expected']>
}

export interface GraphOrganizationWorkUpdate {
  readonly id: string
  readonly changes: Partial<GraphOrganizationWorkAdd>
  readonly expected?: NonNullable<OrganizationWorkUpdate['expected']>
}

export interface GraphWorkRelationUpdate {
  readonly id: string
  readonly changes: Partial<GraphWorkRelationAdd>
  readonly expected?: NonNullable<WorkRelationUpdate['expected']>
}

/** Removal comparisons cover exactly the explicitly removed facts, never a later-expanded range or a graph revision. */
export interface WorkCharacterSnapshot {
  readonly id: string
  readonly binding: WorkCharacterBinding
  readonly note: string | null
  readonly isSpoiler: boolean
}

export interface PersonWorkSnapshot {
  readonly id: string
  readonly binding: PersonWorkBinding
  readonly note: string | null
  readonly isSpoiler: boolean
}

export interface OrganizationWorkSnapshot {
  readonly id: string
  readonly binding: OrganizationWorkBinding
  readonly note: string | null
  readonly isSpoiler: boolean
}

export interface WorkRelationSnapshot {
  readonly id: string
  readonly binding: StoredWorkRelationBinding
  readonly note: string | null
}

interface GraphRelationActions<Add, Update, Snapshot> {
  readonly add?: readonly Add[]
  readonly update?: readonly Update[]
  readonly remove?: readonly string[]
  readonly expected?: readonly Snapshot[]
}

export interface GraphVolumeChapter {
  readonly chapter: GraphPartRef<'comicChapter'>
  readonly numberLabel: string | null
}

export type GraphVolumeChapterChange =
  | { readonly type: 'replace'; readonly items: readonly GraphVolumeChapter[] }
  | {
      readonly type: 'modify'
      readonly add?: readonly GraphVolumeChapter[]
      readonly remove?: readonly GraphPartRef<'comicChapter'>[]
    }

/** Part ownership comes from GraphPartCreate.work, not writable workVolumes/workEpisodes relationship aliases. */
export interface GraphRelations {
  readonly workCharacters?: GraphRelationActions<
    GraphWorkCharacterAdd,
    GraphWorkCharacterUpdate,
    WorkCharacterSnapshot
  >

  readonly personWorks?: GraphRelationActions<
    GraphPersonWorkAdd,
    GraphPersonWorkUpdate,
    PersonWorkSnapshot
  >

  readonly organizationWorks?: GraphRelationActions<
    GraphOrganizationWorkAdd,
    GraphOrganizationWorkUpdate,
    OrganizationWorkSnapshot
  >

  readonly workRelations?: GraphRelationActions<
    GraphWorkRelationAdd,
    GraphWorkRelationUpdate,
    WorkRelationSnapshot
  >

  readonly entryTags?: readonly {
    readonly entry: GraphEntryRef
    readonly change: GraphTagChange
    readonly expected?: readonly EntryTag[]
  }[]

  readonly volumeChapters?: readonly {
    readonly volume: GraphPartRef<'comicVolume'>
    readonly change: GraphVolumeChapterChange
    readonly expected?: readonly VolumeChapter[]
  }[]
}

export const properties = { note: v.nullable(text), isSpoiler: v.boolean() }

export function relationEdit<E extends v.ObjectEntries, B extends v.GenericSchema>(
  fields: E,
  binding: B,
  spoiler: boolean,
) {
  const attrs = { note: properties.note, isSpoiler: spoiler ? properties.isSpoiler : v.never() }
  return v.pipe(
    v.strictObject({
      id,
      changes: v.strictObject(optionalFields({ ...fields, ...attrs })),
      expected: v.exactOptional(
        v.strictObject({ ...optionalFields(attrs), binding: v.exactOptional(binding) }),
      ),
    }),
    v.transform((value) => {
      validateExpectedKeys(value.changes!, value.expected, ['binding'])
      return value
    }),
  )
}

export function actions<
  A extends v.GenericSchema,
  U extends v.GenericSchema<unknown, { id: string }>,
  S extends v.GenericSchema<unknown, { id: string }>,
>(add: A, update: U, snapshot: S, businessKey: (value: v.InferOutput<A>) => string) {
  return v.pipe(
    v.strictObject({
      add: v.exactOptional(
        v.pipe(
          v.array(add),
          v.check((items) => unique(items, businessKey)),
        ),
      ),
      update: v.exactOptional(
        v.pipe(
          v.array(update),
          v.check((items) => unique(items, (item) => item.id)),
        ),
      ),
      remove: v.exactOptional(
        v.pipe(
          v.array(id),
          v.check((items) => unique(items, (item) => item)),
        ),
      ),
      expected: v.exactOptional(
        v.pipe(
          v.array(snapshot),
          v.check((items) => unique(items, (item) => item.id)),
        ),
      ),
    }),
    v.check(
      (value) =>
        !(value.update ?? []).some((item) => value.remove?.includes(item.id)) &&
        (value.expected ?? []).every((item) => value.remove?.includes(item.id)),
    ),
  )
}
