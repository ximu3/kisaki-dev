/** @fileoverview Owns metadata relation members and the finite completeness scopes that authorize local replacement. */

import * as v from 'valibot'
import { DesktopError } from '../errors'
import type { NonEmptyArray } from '../operations'
import { parseValue, unique } from '../validation'
import { isWorkType, workTypes } from '../library/catalog'
import type { EntryType, WorkType } from '../library/catalog'
import {
  canUseOrganizationRole,
  canUsePersonRole,
  organizationRoles,
  personRoles,
  workRelationTypes,
} from '../library/relations'
import type {
  CharacterRole,
  OrganizationRole,
  PersonRole,
  WorkRelationType,
} from '../library/relations'

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

/** A source with unknown actual scope, such as a failed session opening, protects the entire root relation context. */
export type MetadataScopeAnswer<K extends keyof MetadataRelationScopeValues> =
  | {
      readonly status: 'answered'
      readonly empty: boolean
      readonly scope: MetadataRelationScopeValues[K] | null
    }
  | { readonly status: 'unanswered'; readonly scope?: MetadataRelationScopeValues[K] | null }

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

interface ScopeAtom {
  readonly workType: WorkType
  readonly role?: PersonRole | OrganizationRole
  readonly character?: 'none' | 'present'
  readonly relationType?: WorkRelationType
  readonly targetType?: WorkType
}

function atomKey(atom: ScopeAtom): string {
  return JSON.stringify([
    atom.workType,
    atom.role,
    atom.character,
    atom.relationType,
    atom.targetType,
  ])
}

function universe(
  root: EntryType,
  relation: keyof MetadataRelationScopeValues,
): readonly ScopeAtom[] {
  const types = isWorkType(root) ? [root] : workTypes
  const result: ScopeAtom[] = []
  for (const workType of types) {
    if (relation === 'personWorks') {
      for (const role of personRoles) {
        for (const character of ['none', 'present'] as const) {
          if (
            (root !== 'character' || character === 'present') &&
            canUsePersonRole(role, workType, character === 'present')
          ) {
            result.push({ workType, role, character })
          }
        }
      }
    } else if (relation === 'organizationWorks') {
      for (const role of organizationRoles) {
        if (canUseOrganizationRole(role, workType)) {
          result.push({ workType, role })
        }
      }
    } else if (relation === 'workRelations') {
      for (const targetType of workTypes) {
        for (const relationType of workRelationTypes) {
          const sameType = ['remake', 'remakeSource', 'remaster', 'remasterSource'].includes(
            relationType,
          )
          const games = ['port', 'portSource', 'expansion', 'baseGame'].includes(relationType)
          if (
            (!sameType || workType === targetType) &&
            (!games || (workType === 'game' && targetType === 'game'))
          ) {
            result.push({ workType, targetType, relationType })
          }
        }
      }
    } else {
      result.push({ workType })
    }
  }

  return result
}

function scopeAtoms(
  root: EntryType,
  relation: keyof MetadataRelationScopeValues,
  scope: MetadataRelationScopeValues[keyof MetadataRelationScopeValues],
): readonly ScopeAtom[] {
  const all = universe(root, relation)
  if (scope === 'all') {
    return all
  }

  const selected = new Map<string, ScopeAtom>()
  for (const condition of scope) {
    const atoms = all.filter(
      (atom) =>
        (!('workTypes' in condition) ||
          condition.workTypes === undefined ||
          condition.workTypes.includes(atom.workType)) &&
        (!('roles' in condition) ||
          condition.roles === undefined ||
          condition.roles.some((role) => role === atom.role)) &&
        (!('character' in condition) ||
          condition.character === undefined ||
          condition.character === atom.character) &&
        (!('types' in condition) ||
          condition.types === undefined ||
          condition.types.includes(atom.relationType!)) &&
        (!('targetTypes' in condition) ||
          condition.targetTypes === undefined ||
          condition.targetTypes.includes(atom.targetType!)),
    )
    if (atoms.length === 0) {
      throw new DesktopError(
        'InvalidInput',
        'Metadata relation scope contradicts its root, medium or responsibility',
      )
    }

    for (const atom of atoms) {
      selected.set(atomKey(atom), atom)
    }
  }

  return [...selected.values()]
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
  scopeAtoms(root, relation, value)
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

/**
 * Compute only replacement coverage: selected successful scopes minus participating unanswered scopes.
 * Null/unknown participating scope protects the complete root. Returned members are handled separately by field selection.
 */
export function combineMetadataRelationScope<
  T extends EntryType,
  K extends ScopedMetadataRelationKey<T>,
>(
  root: T,
  relation: K,
  answers: readonly MetadataScopeAnswer<K>[],
  selection: 'first' | 'firstNonEmpty' | 'union',
): MetadataRelationScopeValues[K] | undefined {
  const chosen: MetadataScopeAnswer<K>[] = []
  const missing: MetadataScopeAnswer<K>[] = []
  const considered: MetadataScopeAnswer<K>[] = []
  let firstEmpty: MetadataScopeAnswer<K> | undefined
  for (const answer of answers) {
    considered.push(answer)
    if (answer.status === 'unanswered') {
      missing.push(answer)
      continue
    }
    if (selection === 'union') {
      chosen.push(answer)
      continue
    }
    if (selection === 'first' || !answer.empty) {
      chosen.push(answer)
      break
    }
    firstEmpty ??= answer
  }

  if (chosen.length === 0 && firstEmpty) {
    chosen.push(firstEmpty)
  }
  if (
    chosen.length === 0 ||
    considered.some((answer) => answer.scope === null || answer.scope === undefined)
  ) {
    return undefined
  }

  const allowed = new Map<string, ScopeAtom>()
  for (const answer of chosen) {
    const scope = parseMetadataRelationScope(root, relation, answer.scope)
    for (const atom of scopeAtoms(root, relation, scope)) {
      allowed.set(atomKey(atom), atom)
    }
  }

  for (const answer of missing) {
    const scope = parseMetadataRelationScope(root, relation, answer.scope)
    for (const atom of scopeAtoms(root, relation, scope)) {
      allowed.delete(atomKey(atom))
    }
  }

  if (allowed.size === 0) {
    return undefined
  }
  if (allowed.size === universe(root, relation).length) {
    return 'all' as MetadataRelationScopeValues[K]
  }

  const atoms = [...allowed.values()]
  let result: MetadataRelationScopeValues[keyof MetadataRelationScopeValues]
  if (relation === 'workCharacters') {
    const types = [...new Set(atoms.map((atom) => atom.workType))]
    result = [{ workTypes: [types[0]!, ...types.slice(1)] }]
  } else if (relation === 'personWorks') {
    const conditions = atoms.map((atom): PersonWorkScopeCondition => ({
      workTypes: [atom.workType],
      roles: [atom.role as PersonRole],
      character: atom.character!,
    }))
    result = [conditions[0]!, ...conditions.slice(1)]
  } else if (relation === 'organizationWorks') {
    const conditions = atoms.map((atom): Exclude<OrganizationWorkMetadataScope, 'all'>[number] => ({
      workTypes: [atom.workType],
      roles: [atom.role as OrganizationRole],
    }))
    result = [conditions[0]!, ...conditions.slice(1)]
  } else if (relation === 'workRelations') {
    const conditions = atoms.map((atom): Exclude<WorkRelationMetadataScope, 'all'>[number] => ({
      targetTypes: [atom.targetType!],
      types: [atom.relationType!],
    }))
    result = [conditions[0]!, ...conditions.slice(1)]
  } else {
    result = 'all'
  }

  return result as MetadataRelationScopeValues[K]
}
