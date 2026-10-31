/** @fileoverview Defines source relation members and complete-read scopes in their root Entry context. */

import * as v from 'valibot'
import { invalidInput } from '../errors'
import { workTypes, type EntryType, type WorkType } from '../library/identity'
import {
  characterRoles,
  personRoles,
  organizationRoles,
  workRelationTypes,
  isPersonRoleAllowed,
  isOrganizationRoleAllowed,
  type CharacterRole,
  type PersonRole,
  type OrganizationRole,
  type WorkRelationType,
} from '../library/relations'
import { objectSchema } from '../schema'
import {
  exactPartialEntries,
  nonemptyStringSchema,
  parseContract,
  type FieldSchemas,
} from '../validation'

/** Candidate endpoints are keys in this answer, never local IDs or references from another answer. */
export interface MetadataRelationMembers {
  readonly workCharacters: {
    readonly work: string
    readonly character: string
    readonly role?: CharacterRole | null
    readonly note?: string | null
    readonly isSpoiler?: boolean
  }
  readonly personWorks: {
    readonly work: string
    readonly person: string
    readonly role: PersonRole
    readonly character: string | null
    readonly note?: string | null
    readonly isSpoiler?: boolean
  }
  readonly organizationWorks: {
    readonly work: string
    readonly organization: string
    readonly role: OrganizationRole
    readonly note?: string | null
    readonly isSpoiler?: boolean
  }
  readonly workRelations: {
    readonly from: string
    readonly to: string
    readonly type: WorkRelationType
    readonly note?: string | null
  }
  readonly workVolumes: { readonly work: string; readonly volume: string }
  readonly workChapters: { readonly work: string; readonly chapter: string }
  readonly workEpisodes: { readonly work: string; readonly episode: string }
  readonly workExtras: { readonly work: string; readonly extra: string }
  readonly volumeChapters: {
    readonly volume: string
    readonly chapter: string
    readonly numberLabel?: string | null
  }
  readonly entryTags: {
    readonly entry: string
    readonly tag: string
    readonly note?: string | null
    readonly isSpoiler?: boolean
  }
}
export type MetadataRelation = keyof MetadataRelationMembers
/** Nonidentity properties that can be requested and processed independently of relation membership. */
export interface MetadataRelationAttributes {
  readonly workCharacters: 'role' | 'note' | 'isSpoiler'
  readonly personWorks: 'note' | 'isSpoiler'
  readonly organizationWorks: 'note' | 'isSpoiler'
  readonly workRelations: 'note'
  readonly entryTags: 'note' | 'isSpoiler'
  readonly volumeChapters: 'numberLabel'
  readonly workVolumes: never
  readonly workChapters: never
  readonly workEpisodes: never
  readonly workExtras: never
}
const workRelations = [
  'workCharacters',
  'personWorks',
  'organizationWorks',
  'workRelations',
  'entryTags',
] as const
/** Applicable relationships are fixed by the root, including the actual Part ownership lists. */
export const metadataRelationKeys = {
  game: workRelations,
  anime: [...workRelations, 'workEpisodes', 'workExtras'],
  comic: [...workRelations, 'workVolumes', 'workChapters', 'volumeChapters'],
  novel: [...workRelations, 'workVolumes'],
  character: ['workCharacters', 'personWorks', 'entryTags'],
  person: ['personWorks', 'entryTags'],
  organization: ['organizationWorks', 'entryTags'],
} as const satisfies Record<EntryType, readonly MetadataRelation[]>
export type MetadataRelationKey<Type extends EntryType> =
  (typeof metadataRelationKeys)[Type][number]
export type CandidateRelations<Type extends EntryType = EntryType> = {
  readonly [Key in MetadataRelationKey<Type>]?: readonly MetadataRelationMembers[Key][]
}

/** Conditions form a union; dimensions within one condition intersect the legal root-context facts. */
export interface MetadataScopeConditions {
  readonly workCharacters: { readonly workTypes?: readonly WorkType[] }
  readonly personWorks: {
    readonly workTypes?: readonly WorkType[]
    readonly roles?: readonly PersonRole[]
    readonly character?: 'none' | 'present'
  }
  readonly organizationWorks: {
    readonly workTypes?: readonly WorkType[]
    readonly roles?: readonly OrganizationRole[]
  }
  readonly workRelations: {
    readonly types?: readonly WorkRelationType[]
    readonly targetTypes?: readonly WorkType[]
  }
}
export interface MetadataRelationScopeValues {
  readonly workCharacters: 'all' | readonly MetadataScopeConditions['workCharacters'][]
  readonly personWorks: 'all' | readonly MetadataScopeConditions['personWorks'][]
  readonly organizationWorks: 'all' | readonly MetadataScopeConditions['organizationWorks'][]
  readonly workRelations: 'all' | readonly MetadataScopeConditions['workRelations'][]
  readonly entryTags: 'all'
  readonly volumeChapters: 'all'
}
export type MetadataScopeKey<Type extends EntryType> = Extract<
  MetadataRelationKey<Type>,
  keyof MetadataRelationScopeValues
>
export type MetadataRelationScopes<Type extends EntryType = EntryType> = {
  readonly [Key in MetadataScopeKey<Type>]?: MetadataRelationScopeValues[Key]
}
/** A read session can explicitly have no safe replacement scope for an otherwise supported relationship. */
export type MetadataSessionScopes<Type extends EntryType = EntryType> = {
  readonly [Key in MetadataScopeKey<Type>]?: MetadataRelationScopeValues[Key] | null
}

const note = v.exactOptional(v.nullable(v.string()))
const isSpoiler = v.exactOptional(v.boolean())
export const metadataRelationFields = {
  workCharacters: {
    work: nonemptyStringSchema,
    character: nonemptyStringSchema,
    role: v.exactOptional(v.nullable(v.picklist(characterRoles))),
    note,
    isSpoiler,
  },
  personWorks: {
    work: nonemptyStringSchema,
    person: nonemptyStringSchema,
    role: v.picklist(personRoles),
    character: v.nullable(nonemptyStringSchema),
    note,
    isSpoiler,
  },
  organizationWorks: {
    work: nonemptyStringSchema,
    organization: nonemptyStringSchema,
    role: v.picklist(organizationRoles),
    note,
    isSpoiler,
  },
  workRelations: {
    from: nonemptyStringSchema,
    to: nonemptyStringSchema,
    type: v.picklist(workRelationTypes),
    note,
  },
  workVolumes: { work: nonemptyStringSchema, volume: nonemptyStringSchema },
  workChapters: { work: nonemptyStringSchema, chapter: nonemptyStringSchema },
  workEpisodes: { work: nonemptyStringSchema, episode: nonemptyStringSchema },
  workExtras: { work: nonemptyStringSchema, extra: nonemptyStringSchema },
  volumeChapters: {
    volume: nonemptyStringSchema,
    chapter: nonemptyStringSchema,
    numberLabel: v.exactOptional(v.nullable(nonemptyStringSchema)),
  },
  entryTags: { entry: nonemptyStringSchema, tag: nonemptyStringSchema, note, isSpoiler },
} satisfies { [Key in MetadataRelation]: FieldSchemas<MetadataRelationMembers[Key]> }

const relationArrays = {
  workCharacters: v.pipe(
    v.array(objectSchema(metadataRelationFields.workCharacters)),
    v.readonly(),
  ),
  personWorks: v.pipe(v.array(objectSchema(metadataRelationFields.personWorks)), v.readonly()),
  organizationWorks: v.pipe(
    v.array(objectSchema(metadataRelationFields.organizationWorks)),
    v.readonly(),
  ),
  workRelations: v.pipe(v.array(objectSchema(metadataRelationFields.workRelations)), v.readonly()),
  workVolumes: v.pipe(v.array(objectSchema(metadataRelationFields.workVolumes)), v.readonly()),
  workChapters: v.pipe(v.array(objectSchema(metadataRelationFields.workChapters)), v.readonly()),
  workEpisodes: v.pipe(v.array(objectSchema(metadataRelationFields.workEpisodes)), v.readonly()),
  workExtras: v.pipe(v.array(objectSchema(metadataRelationFields.workExtras)), v.readonly()),
  volumeChapters: v.pipe(
    v.array(objectSchema(metadataRelationFields.volumeChapters)),
    v.readonly(),
  ),
  entryTags: v.pipe(v.array(objectSchema(metadataRelationFields.entryTags)), v.readonly()),
}
const relationObject = v.strictObject(exactPartialEntries(relationArrays))
export const candidateRelationSchemas: {
  [Type in EntryType]: v.GenericSchema<unknown, CandidateRelations<Type>>
} = {
  game: objectSchema(v.pick(relationObject, metadataRelationKeys.game).entries),
  anime: objectSchema(v.pick(relationObject, metadataRelationKeys.anime).entries),
  comic: objectSchema(v.pick(relationObject, metadataRelationKeys.comic).entries),
  novel: objectSchema(v.pick(relationObject, metadataRelationKeys.novel).entries),
  character: objectSchema(v.pick(relationObject, metadataRelationKeys.character).entries),
  person: objectSchema(v.pick(relationObject, metadataRelationKeys.person).entries),
  organization: objectSchema(v.pick(relationObject, metadataRelationKeys.organization).entries),
}

function choices<const Values extends readonly [string, ...string[]]>(values: Values) {
  return v.pipe(
    v.array(v.picklist(values)),
    v.minLength(1),
    v.check((items) => new Set(items).size === items.length),
    v.readonly(),
  )
}
function conditions<Entries extends v.ObjectEntries>(entries: Entries) {
  return v.union([
    v.literal('all'),
    v.pipe(
      v.array(
        v.pipe(
          objectSchema(exactPartialEntries(entries)),
          v.check((value) => Object.keys(value).length > 0),
        ),
      ),
      v.minLength(1),
      v.readonly(),
    ),
  ])
}
export const personScopeConditionFields = {
  workTypes: choices(workTypes),
  roles: choices(personRoles),
  character: v.picklist(['none', 'present']),
}
export const scopeFields = {
  workCharacters: conditions({ workTypes: choices(workTypes) }),
  personWorks: conditions(personScopeConditionFields),
  organizationWorks: conditions({
    workTypes: choices(workTypes),
    roles: choices(organizationRoles),
  }),
  workRelations: conditions({ types: choices(workRelationTypes), targetTypes: choices(workTypes) }),
  entryTags: v.literal('all'),
  volumeChapters: v.literal('all'),
} satisfies FieldSchemas<MetadataRelationScopeValues>
const scopeObject = v.strictObject(exactPartialEntries(scopeFields))
export const relationScopeSchemas: {
  [Type in EntryType]: v.GenericSchema<unknown, MetadataRelationScopes<Type>>
} = {
  game: objectSchema(v.omit(scopeObject, ['volumeChapters']).entries),
  anime: objectSchema(v.omit(scopeObject, ['volumeChapters']).entries),
  comic: objectSchema(scopeObject.entries),
  novel: objectSchema(v.omit(scopeObject, ['volumeChapters']).entries),
  character: objectSchema(
    v.pick(scopeObject, ['workCharacters', 'personWorks', 'entryTags']).entries,
  ),
  person: objectSchema(v.pick(scopeObject, ['personWorks', 'entryTags']).entries),
  organization: objectSchema(v.pick(scopeObject, ['organizationWorks', 'entryTags']).entries),
}

/** Validate explicit replacement coverage; absent keys and null session scopes never imply all. */
export function parseMetadataRelationScopes<Type extends EntryType>(
  type: Type,
  input: unknown,
): MetadataRelationScopes<Type> {
  const scopes = parseContract(relationScopeSchemas[type], input, 'metadata relation scopes')
  validateScopeContext(type, scopes)
  return scopes
}

/** Check already parsed source or user scope against the root's actual relation vocabulary. */
export function validateScopeContext(type: EntryType, scopes: MetadataRelationScopes): void {
  const rootWorks = workTypes.filter((work) => type === work)
  const applicableWorks = rootWorks.length ? rootWorks : workTypes
  for (const key of ['workCharacters', 'personWorks', 'organizationWorks'] as const) {
    const scope = scopes[key]
    if (!scope || scope === 'all') {
      continue
    }
    for (const condition of scope) {
      if (condition.workTypes?.some((work) => !applicableWorks.includes(work))) {
        invalidInput('Relation scope contradicts its root work.')
      }
    }
  }
  const people = scopes.personWorks
  if (people && people !== 'all') {
    for (const condition of people) {
      if (type === 'character' && condition.character === 'none') {
        invalidInput('Character relations require an actual character.')
      }
      let characters = [false, true]
      if (type === 'character' || condition.character === 'present') {
        characters = [true]
      } else if (condition.character === 'none') {
        characters = [false]
      }
      if (
        !(condition.workTypes ?? applicableWorks).some((work) =>
          (condition.roles ?? personRoles).some((role) =>
            characters.some((character) => isPersonRoleAllowed(role, work, character)),
          ),
        )
      ) {
        invalidInput('Person scope has no legal relationship.')
      }
    }
  }
  const organizations = scopes.organizationWorks
  if (organizations && organizations !== 'all') {
    for (const condition of organizations) {
      if (
        !(condition.workTypes ?? applicableWorks).some((work) =>
          (condition.roles ?? organizationRoles).some((role) =>
            isOrganizationRoleAllowed(role, work),
          ),
        )
      ) {
        invalidInput('Organization scope has no legal relationship.')
      }
    }
  }
}
