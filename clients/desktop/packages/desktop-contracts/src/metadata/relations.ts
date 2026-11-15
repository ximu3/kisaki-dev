/** @fileoverview Defines metadata relation members and completeness evidence used by local replacement. */

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

/**
 * Relationship fact shapes using keys from one response or candidate graph.
 *
 * Optional attributes belong directly to each fact.
 */
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

/**
 * Selectable, processable non-identity attribute types for each relation family.
 *
 * Empty maps identify membership-only relations.
 */
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

/** Relation family available in the selected metadata root context. */
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

/** Graph-local relation members grouped by families supported by the root kind. */
export type MetadataRelations<T extends EntryType> = {
  readonly [K in MetadataRelationKey<T>]?: readonly MetadataRelationMembers[K][]
}

/** Composed graph relations with the same member meanings as source response relations. */
export type CandidateRelations<T extends EntryType> = MetadataRelations<T>

/** Object shape requiring at least one selected dimension while leaving the others optional. */
type AtLeastOne<T> = { [K in keyof T]: Required<Pick<T, K>> & Partial<Omit<T, K>> }[keyof T]

/**
 * Complete work-character coverage, either all legal relations or a union of work-type conditions.
 */
export type WorkCharacterMetadataScope =
  'all' | NonEmptyArray<{ readonly workTypes: NonEmptyArray<WorkType> }>

/**
 * Intersecting work-type, responsibility and character-presence constraints on person-work
 * coverage.
 */
export type PersonWorkScopeCondition = AtLeastOne<{
  readonly workTypes: NonEmptyArray<WorkType>
  readonly roles: NonEmptyArray<PersonRole>
  readonly character: 'none' | 'present'
}>

/** Complete person-work coverage, either all legal relations or a union of explicit conditions. */
export type PersonWorkMetadataScope = 'all' | NonEmptyArray<PersonWorkScopeCondition>

/**
 * Complete organization-work coverage expressed as all relations or a union of intersecting
 * work-type and role conditions.
 */
export type OrganizationWorkMetadataScope =
  | 'all'
  | NonEmptyArray<
      AtLeastOne<{
        readonly workTypes: NonEmptyArray<WorkType>
        readonly roles: NonEmptyArray<OrganizationRole>
      }>
    >

/**
 * Complete work-relation coverage expressed as all relations or a union of intersecting
 * relation-kind and target-medium conditions.
 */
export type WorkRelationMetadataScope =
  | 'all'
  | NonEmptyArray<
      AtLeastOne<{
        readonly types: NonEmptyArray<WorkRelationType>
        readonly targetTypes: NonEmptyArray<WorkType>
      }>
    >

/**
 * Finite completeness-scope vocabulary for relation families with explicit replacement evidence.
 */
export interface MetadataRelationScopeValues {
  readonly workCharacters: WorkCharacterMetadataScope
  readonly personWorks: PersonWorkMetadataScope
  readonly organizationWorks: OrganizationWorkMetadataScope
  readonly workRelations: WorkRelationMetadataScope
  readonly entryTags: 'all'
  readonly volumeChapters: 'all'
}

/** Root-compatible relation family whose completeness has an explicit scope value. */
export type ScopedMetadataRelationKey<T extends EntryType = EntryType> = Extract<
  MetadataRelationKey<T>,
  keyof MetadataRelationScopeValues
>

/**
 * Expressible completeness evidence supplied alongside a composed candidate.
 *
 * Omission means no replacement evidence for that relation. User scope separately authorizes
 * changes; part-ownership lists use their implicit root-work scope.
 */
export type MetadataRelationScopes<T extends EntryType = EntryType> = {
  readonly [K in ScopedMetadataRelationKey<T>]?: MetadataRelationScopeValues[K]
}

/**
 * Completeness scopes fixed by a provider session.
 *
 * Null denotes coverage outside the finite scope vocabulary and supplies adoptable facts without
 * replacement evidence. The provider still owes a complete read of that coverage.
 */
export type MetadataSessionRelationScopes<T extends EntryType = EntryType> = {
  readonly [K in ScopedMetadataRelationKey<T>]?:
    MetadataRelationScopeValues[K] | (K extends 'entryTags' | 'volumeChapters' ? never : null)
}

/**
 * Returns relation families applicable to the root kind for capabilities, requests, candidates and
 * profiles.
 */
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

/** Creates a nonempty, duplicate-free selection schema for a finite scope dimension. */
function choices<T extends string>(values: readonly T[]) {
  return v.pipe(
    v.tupleWithRest([v.picklist(values)], v.picklist(values)),
    v.check((items) => unique(items, (item) => item)),
  )
}

/** Nonempty selected work media used by relation-coverage conditions. */
const workChoices = choices(workTypes)

/** Nonempty selected person responsibilities used by relation-coverage conditions. */
const personChoices = choices(personRoles)

/** Nonempty selected organization responsibilities used by relation-coverage conditions. */
const organizationChoices = choices(organizationRoles)

/** Nonempty selected work-relation directions used by coverage conditions. */
const relationChoices = choices(workRelationTypes)

/** Nonempty combination of work medium, responsibility and character-binding coverage. */
const personCondition = v.pipe(
  v.strictObject({
    workTypes: v.exactOptional(workChoices),
    roles: v.exactOptional(personChoices),
    character: v.exactOptional(v.picklist(['none', 'present'])),
  }),
  v.check((value) => Object.keys(value).length > 0),
)

/** Nonempty combination of work medium and organization-role coverage. */
const organizationCondition = v.pipe(
  v.strictObject({
    workTypes: v.exactOptional(workChoices),
    roles: v.exactOptional(organizationChoices),
  }),
  v.check((value) => Object.keys(value).length > 0),
)

/** Nonempty relation-direction or target-medium coverage condition. */
const workRelationCondition = v.pipe(
  v.strictObject({
    types: v.exactOptional(relationChoices),
    targetTypes: v.exactOptional(workChoices),
  }),
  v.check((value) => Object.keys(value).length > 0),
)

/** Work-medium coverage condition for character participation. */
const characterCondition = v.strictObject({ workTypes: workChoices })

/** Complete or explicitly bounded coverage shapes for each supported metadata relation view. */
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

/** Checks whether a scope condition admits at least one legal relation in its root context. */
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

/** Parses one completeness scope and rejects conditions impossible in the declared root context. */
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

/**
 * Parses explicit completeness evidence for root-compatible relation families.
 *
 * Omitted scopes remain absent.
 */
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

/**
 * Parses session completeness scopes, preserving non-expressible coverage as null where allowed.
 *
 * Tag and volume-chapter scopes remain fixed to all.
 */
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
