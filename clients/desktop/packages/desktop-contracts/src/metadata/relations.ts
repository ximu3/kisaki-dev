/** @fileoverview Owns metadata relation members and the finite completeness scopes that authorize local replacement. */

import type {
  CharacterRole,
  PersonRole,
  OrganizationRole,
  WorkRelationType,
} from '../library/relations'
import type { EntryType, WorkType } from '../library/catalog'
import type { NonEmptyArray } from '../operations'
import { isWorkType, workTypes } from '../library/catalog'
import * as v from 'valibot'
import { unique, parseValue } from '../validation'
import {
  personRoles,
  organizationRoles,
  workRelationTypes,
  canUsePersonRole,
  canUseWorkRelation,
  canUseOrganizationRole,
} from '../library/relations'
import { DesktopError } from '../errors'

/** Each member uses keys from exactly one response/candidate graph, with attributes directly on the fact. */
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

/** Only non-identity attributes are selectable or processed. Empty maps mean membership-only relations. */
export interface MetadataRelationAttributeValues {
  readonly workCharacters: {
    readonly role: CharacterRole | null
    readonly note: string | null
    readonly isSpoiler: boolean
  }
  readonly personWorks: { readonly note: string | null; readonly isSpoiler: boolean }
  readonly organizationWorks: { readonly note: string | null; readonly isSpoiler: boolean }
  readonly workRelations: { readonly note: string | null }
  readonly entryTags: { readonly note: string | null; readonly isSpoiler: boolean }
  readonly volumeChapters: { readonly numberLabel: string | null }

  readonly workVolumes: Readonly<Record<never, never>>
  readonly workChapters: Readonly<Record<never, never>>
  readonly workEpisodes: Readonly<Record<never, never>>
  readonly workExtras: Readonly<Record<never, never>>
}

export type MetadataRelationKey<T extends EntryType = EntryType> =
  | 'entryTags'
  | (T extends WorkType
      ? 'workCharacters' | 'personWorks' | 'organizationWorks' | 'workRelations'
      : T extends 'character'
        ? 'workCharacters' | 'personWorks'
        : T extends 'person'
          ? 'personWorks'
          : 'organizationWorks')
  | (T extends 'anime'
      ? 'workEpisodes' | 'workExtras'
      : T extends 'comic'
        ? 'workVolumes' | 'workChapters' | 'volumeChapters'
        : T extends 'novel'
          ? 'workVolumes'
          : never)

export type MetadataRelations<T extends EntryType> = {
  readonly [K in MetadataRelationKey<T>]?: readonly MetadataRelationMembers[K][]
}

/** Candidate keys refer to the composed graph; the member semantics are identical to provider response members. */
export type CandidateRelations<T extends EntryType> = MetadataRelations<T>

type AtLeastOne<T> = { [K in keyof T]: Required<Pick<T, K>> & Partial<Omit<T, K>> }[keyof T]

export type WorkCharacterMetadataScope =
  'all' | NonEmptyArray<{ readonly workTypes: NonEmptyArray<WorkType> }>

export type PersonWorkScopeCondition = AtLeastOne<{
  readonly workTypes: NonEmptyArray<WorkType>
  readonly roles: NonEmptyArray<PersonRole>
  readonly character: 'none' | 'present'
}>

export type PersonWorkMetadataScope = 'all' | NonEmptyArray<PersonWorkScopeCondition>

export type OrganizationWorkMetadataScope =
  | 'all'
  | NonEmptyArray<
      AtLeastOne<{
        readonly workTypes: NonEmptyArray<WorkType>
        readonly roles: NonEmptyArray<OrganizationRole>
      }>
    >

export type WorkRelationMetadataScope =
  | 'all'
  | NonEmptyArray<
      AtLeastOne<{
        readonly types: NonEmptyArray<WorkRelationType>
        readonly targetTypes: NonEmptyArray<WorkType>
      }>
    >

export interface MetadataRelationScopeValues {
  readonly workCharacters: WorkCharacterMetadataScope
  readonly personWorks: PersonWorkMetadataScope
  readonly organizationWorks: OrganizationWorkMetadataScope
  readonly workRelations: WorkRelationMetadataScope
  readonly entryTags: 'all'
  readonly volumeChapters: 'all'
}

export type ScopedMetadataRelationKey<T extends EntryType = EntryType> = Extract<
  MetadataRelationKey<T>,
  keyof MetadataRelationScopeValues
>

/** Omission means there is no replacement evidence; part-ownership lists have an implicit root-work scope instead. */
export type MetadataRelationScopes<T extends EntryType = EntryType> = {
  readonly [K in ScopedMetadataRelationKey<T>]?: MetadataRelationScopeValues[K]
}

/** A provider may explicitly declare a non-expressible completeness scope as null; it still owes a complete read. */
export type MetadataSessionRelationScopes<T extends EntryType = EntryType> = {
  readonly [K in ScopedMetadataRelationKey<T>]?:
    MetadataRelationScopeValues[K] | (K extends 'entryTags' | 'volumeChapters' ? never : null)
}

/** Complete finite relation applicability, shared by capabilities, requests, candidates and profiles. */
export function getMetadataRelations<T extends EntryType>(
  root: T,
): readonly MetadataRelationKey<T>[] {
  const result: (keyof MetadataRelationMembers)[] = ['entryTags']
  if (isWorkType(root)) {
    result.push('workCharacters', 'personWorks', 'organizationWorks', 'workRelations')
  } else if (root === 'character') {
    result.push('workCharacters', 'personWorks')
  } else if (root === 'person') {
    result.push('personWorks')
  } else {
    result.push('organizationWorks')
  }

  if (root === 'anime') {
    result.push('workEpisodes', 'workExtras')
  }
  if (root === 'comic') {
    result.push('workVolumes', 'workChapters', 'volumeChapters')
  }
  if (root === 'novel') {
    result.push('workVolumes')
  }

  return result as MetadataRelationKey<T>[]
}

/** The exact non-identity property vocabulary; an empty field list still requests the whole relation membership. */
export const metadataRelationFields: {
  readonly [K in keyof MetadataRelationMembers]: readonly Extract<
    keyof MetadataRelationAttributeValues[K],
    string
  >[]
} = {
  workCharacters: ['role', 'note', 'isSpoiler'],
  personWorks: ['note', 'isSpoiler'],
  organizationWorks: ['note', 'isSpoiler'],
  workRelations: ['note'],
  entryTags: ['note', 'isSpoiler'],
  volumeChapters: ['numberLabel'],
  workVolumes: [],
  workChapters: [],
  workEpisodes: [],
  workExtras: [],
}

function choices<T extends string>(values: readonly T[]) {
  return v.pipe(
    v.tupleWithRest([v.picklist(values)], v.picklist(values)),
    v.check((items) => unique(items, (item) => item)),
  )
}

const workChoices = choices(workTypes)

const personChoices = choices(personRoles)

const organizationChoices = choices(organizationRoles)

const relationChoices = choices(workRelationTypes)

const personCondition = v.pipe(
  v.strictObject({
    workTypes: v.exactOptional(workChoices),
    roles: v.exactOptional(personChoices),
    character: v.exactOptional(v.picklist(['none', 'present'])),
  }),
  v.check((value) => Object.keys(value).length > 0),
)

const organizationCondition = v.pipe(
  v.strictObject({
    workTypes: v.exactOptional(workChoices),
    roles: v.exactOptional(organizationChoices),
  }),
  v.check((value) => Object.keys(value).length > 0),
)

const workRelationCondition = v.pipe(
  v.strictObject({
    types: v.exactOptional(relationChoices),
    targetTypes: v.exactOptional(workChoices),
  }),
  v.check((value) => Object.keys(value).length > 0),
)

const characterCondition = v.strictObject({ workTypes: workChoices })

const scopeSchemas = {
  workCharacters: v.union([
    v.literal('all'),
    v.tupleWithRest([characterCondition], characterCondition),
  ]),
  personWorks: v.union([v.literal('all'), v.tupleWithRest([personCondition], personCondition)]),
  organizationWorks: v.union([
    v.literal('all'),
    v.tupleWithRest([organizationCondition], organizationCondition),
  ]),
  workRelations: v.union([
    v.literal('all'),
    v.tupleWithRest([workRelationCondition], workRelationCondition),
  ]),
  entryTags: v.literal('all'),
  volumeChapters: v.literal('all'),
}

/** Each condition must admit at least one legal relation in the declared root context. */
function hasScopeMembers(
  root: EntryType,
  relation: keyof MetadataRelationScopeValues,
  condition: Exclude<MetadataRelationScopeValues[keyof MetadataRelationScopeValues], 'all'>[number],
): boolean {
  const types = isWorkType(root) ? [root] : workTypes
  if (relation === 'workRelations') {
    const value = condition as Exclude<WorkRelationMetadataScope, 'all'>[number]
    return types.some((type) =>
      (value.targetTypes ?? workTypes).some((target) =>
        (value.types ?? workRelationTypes).some((relation) =>
          canUseWorkRelation(relation, type, target),
        ),
      ),
    )
  }

  const selected = 'workTypes' in condition && condition.workTypes ? condition.workTypes : types
  const matchingTypes = types.filter((type) => selected.includes(type))
  if (relation === 'personWorks') {
    const value = condition as PersonWorkScopeCondition
    const characters = value.character ? [value.character] : ['none', 'present']
    return matchingTypes.some((type) =>
      (value.roles ?? personRoles).some((role) =>
        characters.some(
          (character) =>
            (root !== 'character' || character === 'present') &&
            canUsePersonRole(role, type, character === 'present'),
        ),
      ),
    )
  }
  if (relation === 'organizationWorks') {
    const value = condition as Exclude<OrganizationWorkMetadataScope, 'all'>[number]
    return matchingTypes.some((type) =>
      (value.roles ?? organizationRoles).some((role) => canUseOrganizationRole(role, type)),
    )
  }
  return matchingTypes.length > 0
}

/** Validate one finite scope in its actual root context; impossible role/media/character combinations are not adopted. */
export function parseMetadataRelationScope<
  T extends EntryType,
  K extends ScopedMetadataRelationKey<T>,
>(root: T, relation: K, input: unknown): MetadataRelationScopeValues[K] {
  if (!getMetadataRelations(root).includes(relation)) {
    throw new DesktopError('InvalidInput', 'Relation is not applicable to this metadata root')
  }

  const value = parseValue(
    scopeSchemas[relation],
    input,
    'Invalid metadata relation scope',
  ) as MetadataRelationScopeValues[K]
  if (value !== 'all' && value.some((condition) => !hasScopeMembers(root, relation, condition))) {
    throw new DesktopError(
      'InvalidInput',
      'Metadata relation scope contradicts its root, medium or responsibility',
    )
  }
  return value
}

/** Parse only explicitly supported replacement evidence; no scope for unrequested part-ownership lists is invented. */
export function parseMetadataRelationScopes<T extends EntryType>(
  root: T,
  input: unknown,
): MetadataRelationScopes<T> {
  const entries = Object.fromEntries(
    getMetadataRelations(root)
      .filter((relation) => Object.hasOwn(scopeSchemas, relation))
      .map((relation) => [
        relation,
        v.exactOptional(
          v.pipe(
            v.unknown(),
            v.transform((value) =>
              parseMetadataRelationScope(root, relation as ScopedMetadataRelationKey<T>, value),
            ),
          ),
        ),
      ]),
  )
  return parseValue(
    v.strictObject(entries),
    input,
    'Invalid metadata relation scopes',
  ) as MetadataRelationScopes<T>
}

/** Preserve an explicit non-expressible provider scope as null; tag and volume scopes remain fixed all. */
export function parseMetadataSessionRelationScopes<T extends EntryType>(
  root: T,
  input: unknown,
): MetadataSessionRelationScopes<T> {
  const entries = Object.fromEntries(
    getMetadataRelations(root)
      .filter((relation) => Object.hasOwn(scopeSchemas, relation))
      .map((relation) => {
        const schema = v.pipe(
          v.unknown(),
          v.transform((value) =>
            parseMetadataRelationScope(root, relation as ScopedMetadataRelationKey<T>, value),
          ),
        )
        return [
          relation,
          v.exactOptional(
            relation === 'entryTags' || relation === 'volumeChapters' ? schema : v.nullable(schema),
          ),
        ]
      }),
  )
  return parseValue(
    v.strictObject(entries),
    input,
    'Invalid provider session relation scopes',
  ) as MetadataSessionRelationScopes<T>
}
