import type { ListOptions, CallOptions, ListResult } from '../operations'
import type { ReorderInput, MoveInput } from './ordering'
import * as v from 'valibot'
import {
  fromParser,
  id,
  text,
  parseValue,
  optionalFields,
  validateExpectedKeys,
} from '../validation'
import { workRefSchema, type WorkType, type WorkRef, type EntryRef } from './catalog'
import { DesktopError } from '../errors'
import { compareIdentityText } from '../scalar-order'

/** Role in this work; null means an existing association whose importance is not classified. */
export const characterRoles = Object.freeze(['main', 'supporting', 'cameo', 'other'] as const)

export type CharacterRole = (typeof characterRoles)[number]

/** Common work responsibilities, not professions or relationships without a work. */
export const personRoles = Object.freeze([
  'creator',
  'characterCreator',
  'originalCreator',
  'director',
  'scenario',
  'seriesComposition',
  'direction',
  'storyboard',
  'characterDesign',
  'illustration',
  'drawing',
  'animationDirector',
  'art',
  'photography',
  'sound',
  'music',
  'programmer',
  'producer',
  'publisher',
  'translator',
  'editor',
  'voiceActor',
  'other',
] as const)

export type PersonRole = (typeof personRoles)[number]

export const organizationRoles = Object.freeze([
  'creator',
  'originalCreator',
  'developer',
  'studio',
  'producer',
  'music',
  'sound',
  'publisher',
  'distributor',
  'imprint',
  'localization',
  'other',
] as const)

export type OrganizationRole = (typeof organizationRoles)[number]

export type CharacterPersonRole =
  | 'characterCreator'
  | 'characterDesign'
  | 'drawing'
  | 'illustration'
  | 'voiceActor'
  | 'other'

type CommonPersonRole =
  | 'creator'
  | 'characterCreator'
  | 'originalCreator'
  | 'characterDesign'
  | 'illustration'
  | 'art'
  | 'publisher'
  | 'translator'
  | 'editor'
  | 'other'

type AudiovisualPersonRole =
  | 'director'
  | 'scenario'
  | 'direction'
  | 'storyboard'
  | 'drawing'
  | 'animationDirector'
  | 'photography'
  | 'sound'
  | 'music'
  | 'producer'
  | 'voiceActor'

export type PersonRoleFor<T extends WorkType> =
  | CommonPersonRole
  | (T extends 'game'
      ? AudiovisualPersonRole | 'programmer'
      : T extends 'anime'
        ? AudiovisualPersonRole | 'seriesComposition'
        : T extends 'comic'
          ? 'scenario' | 'storyboard' | 'drawing'
          : never)

export type OrganizationRoleFor<T extends WorkType> =
  | 'creator'
  | 'originalCreator'
  | 'publisher'
  | 'distributor'
  | 'localization'
  | 'other'
  | (T extends 'game'
      ? 'developer' | 'studio' | 'producer' | 'music' | 'sound'
      : T extends 'anime'
        ? 'studio' | 'producer' | 'music' | 'sound'
        : 'imprint')

/**
 * Note and spoiler state belong to the relation. Entry descriptions and sensitivity are separate.
 */
export interface RelationProperties {
  readonly note: string | null
  readonly isSpoiler: boolean
}

/** Work-character association with an optional classification of narrative importance. */
export interface WorkCharacterBinding {
  readonly work: WorkRef
  readonly character: EntryRef<'character'>
  readonly role: CharacterRole | null
}

/**
 * A character-qualified binding requires the corresponding work-character association at commit.
 */
export type PersonWorkBinding = {
  [K in WorkType]: { readonly work: EntryRef<K>; readonly person: EntryRef<'person'> } & (
    | {
        readonly role: Extract<PersonRoleFor<K>, CharacterPersonRole>
        readonly character: EntryRef<'character'> | null
      }
    | { readonly role: Exclude<PersonRoleFor<K>, CharacterPersonRole>; readonly character: null }
  )
}[WorkType]

/** Organization's credited responsibility constrained by the work medium. */
export type OrganizationWorkBinding = {
  [K in WorkType]: {
    readonly work: EntryRef<K>
    readonly organization: EntryRef<'organization'>
    readonly role: OrganizationRoleFor<K>
  }
}[WorkType]

/** Directed types are read from the current endpoint; symmetric types keep one stored fact too. */
export const workRelationTypes = Object.freeze([
  'sequel',
  'prequel',
  'sideStory',
  'mainStory',
  'spinOff',
  'spinOffOrigin',
  'summary',
  'fullStory',
  'adaptation',
  'sourceMaterial',
  'remake',
  'remakeSource',
  'remaster',
  'remasterSource',
  'port',
  'portSource',
  'expansion',
  'baseGame',
  'compilation',
  'includedWork',
  'alternativeVersion',
  'related',
] as const)

export type WorkRelationType = (typeof workRelationTypes)[number]

/** Canonical relationship kinds used to store each directed or symmetric work relation once. */
export type StoredWorkRelationType =
  | 'sequel'
  | 'sideStory'
  | 'spinOff'
  | 'summary'
  | 'adaptation'
  | 'remake'
  | 'remaster'
  | 'port'
  | 'expansion'
  | 'compilation'
  | 'alternativeVersion'
  | 'related'

export interface WorkRelationBinding {
  readonly from: WorkRef
  readonly to: WorkRef
  readonly type: WorkRelationType
}

/** Canonical endpoint order is independent of either side's display order. */
export interface StoredWorkRelationBinding extends WorkRelationBinding {
  readonly type: StoredWorkRelationType
}

export interface WorkCharacter extends WorkCharacterBinding, RelationProperties {
  readonly id: string
}

export type PersonWork = PersonWorkBinding & RelationProperties & { readonly id: string }

export type OrganizationWork = OrganizationWorkBinding &
  RelationProperties & { readonly id: string }

export interface WorkRelation extends StoredWorkRelationBinding {
  readonly id: string
  readonly note: string | null
}

/** The nullable role is explicit. Omitted note and spoiler attributes default to null and false. */
export type WorkCharacterCreate = WorkCharacterBinding & Partial<RelationProperties>

export type PersonWorkCreate = PersonWorkBinding & Partial<RelationProperties>

export type OrganizationWorkCreate = OrganizationWorkBinding & Partial<RelationProperties>

export type WorkRelationCreate = WorkRelationBinding & { readonly note?: string | null }

/**
 * A supplied binding baseline compares the complete original association, even for a note-only
 * edit.
 */
export interface WorkCharacterUpdate {
  readonly changes: Partial<WorkCharacterBinding & RelationProperties>
  readonly expected?: Partial<RelationProperties> & { readonly binding?: WorkCharacterBinding }
}

export interface PersonWorkUpdate {
  readonly changes: Partial<
    {
      readonly work: WorkRef
      readonly person: EntryRef<'person'>
      readonly character: EntryRef<'character'> | null
      readonly role: PersonRole
    } & RelationProperties
  >
  readonly expected?: Partial<RelationProperties> & { readonly binding?: PersonWorkBinding }
}

export interface OrganizationWorkUpdate {
  readonly changes: Partial<
    {
      readonly work: WorkRef
      readonly organization: EntryRef<'organization'>
      readonly role: OrganizationRole
    } & RelationProperties
  >
  readonly expected?: Partial<RelationProperties> & { readonly binding?: OrganizationWorkBinding }
}

export interface WorkRelationUpdate {
  readonly changes: Partial<WorkRelationBinding & { readonly note: string | null }>
  readonly expected?: {
    readonly binding?: StoredWorkRelationBinding
    readonly note?: string | null
  }
}

export type WorkCharacterScope =
  | { readonly side: 'work'; readonly work: WorkRef }
  | { readonly side: 'character'; readonly characterId: string }

export type PersonWorkScope =
  | { readonly side: 'work'; readonly work: WorkRef }
  | { readonly side: 'person'; readonly personId: string }
  | { readonly side: 'character'; readonly characterId: string }

export type OrganizationWorkScope =
  | { readonly side: 'work'; readonly work: WorkRef }
  | { readonly side: 'organization'; readonly organizationId: string }

export type WorkRelationScope = { readonly side: 'from' | 'to'; readonly work: WorkRef }

interface RelationApi<Scope, Fact, Create, Update> {
  /** Reads an interval of actual relation rows in the selected side's formal order. */
  list(scope: Scope, options: ListOptions, call?: CallOptions): Promise<ListResult<Fact>>

  get(id: string, call?: CallOptions): Promise<Fact | null>

  /** Duplicate creation reports Conflict. Graph addition has its own idempotence rules. */
  create(input: Create, call?: CallOptions): Promise<string>

  /**
   * Commits relation edits after checking supplied baselines and the resulting binding's
   * constraints.
   */
  update(id: string, input: Update, call?: CallOptions): Promise<void>

  /** Deletes the identified relation and its associated ordering entries. */
  delete(id: string, call?: CallOptions): Promise<void>

  reorder(scope: Scope, input: ReorderInput, call?: CallOptions): Promise<void>

  move(scope: Scope, input: MoveInput, call?: CallOptions): Promise<void>
}

export interface RelationsApi {
  readonly workCharacters: RelationApi<
    WorkCharacterScope,
    WorkCharacter,
    WorkCharacterCreate,
    WorkCharacterUpdate
  >

  readonly personWorks: RelationApi<PersonWorkScope, PersonWork, PersonWorkCreate, PersonWorkUpdate>

  readonly organizationWorks: RelationApi<
    OrganizationWorkScope,
    OrganizationWork,
    OrganizationWorkCreate,
    OrganizationWorkUpdate
  >

  readonly workRelations: RelationApi<
    WorkRelationScope,
    WorkRelation,
    WorkRelationCreate,
    WorkRelationUpdate
  >
}

export const characterRefSchema = v.strictObject({ type: v.literal('character'), id })

export const personRefSchema = v.strictObject({ type: v.literal('person'), id })

export const organizationRefSchema = v.strictObject({ type: v.literal('organization'), id })

export const relationPropertyEntries = { note: v.nullable(text), isSpoiler: v.boolean() }

export const workCharacterBindingEntries = {
  work: workRefSchema,
  character: characterRefSchema,
  role: v.nullable(v.picklist(characterRoles)),
}

export const personWorkBindingEntries = {
  work: workRefSchema,
  person: personRefSchema,
  character: v.nullable(characterRefSchema),
  role: v.picklist(personRoles),
}

export const organizationWorkBindingEntries = {
  work: workRefSchema,
  organization: organizationRefSchema,
  role: v.picklist(organizationRoles),
}

export const workRelationBindingEntries = {
  from: workRefSchema,
  to: workRefSchema,
  type: v.picklist(workRelationTypes),
}

/** Medium restrictions for specialized person roles; absent roles apply to every work medium. */
const personRoleWorkTypes: Readonly<Partial<Record<PersonRole, readonly WorkType[]>>> = {
  director: ['game', 'anime'],
  scenario: ['game', 'anime', 'comic'],
  seriesComposition: ['anime'],
  direction: ['game', 'anime'],
  storyboard: ['game', 'anime', 'comic'],
  drawing: ['game', 'anime', 'comic'],
  animationDirector: ['game', 'anime'],
  photography: ['game', 'anime'],
  sound: ['game', 'anime'],
  music: ['game', 'anime'],
  programmer: ['game'],
  producer: ['game', 'anime'],
  voiceActor: ['game', 'anime'],
}

/**
 * Medium restrictions for specialized organization roles; absent roles apply to every work medium.
 */
const organizationRoleWorkTypes: Readonly<Partial<Record<OrganizationRole, readonly WorkType[]>>> =
  {
    developer: ['game'],
    studio: ['game', 'anime'],
    producer: ['game', 'anime'],
    music: ['game', 'anime'],
    sound: ['game', 'anime'],
    imprint: ['comic', 'novel'],
  }

const characterPersonRoles: readonly PersonRole[] = [
  'characterCreator',
  'characterDesign',
  'drawing',
  'illustration',
  'voiceActor',
  'other',
]

export function canUsePersonRole(
  role: PersonRole,
  workType: WorkType,
  hasCharacter: boolean,
): boolean {
  return (
    (personRoleWorkTypes[role]?.includes(workType) ?? true) &&
    (!hasCharacter || characterPersonRoles.includes(role))
  )
}

export function canUseOrganizationRole(role: OrganizationRole, workType: WorkType): boolean {
  return organizationRoleWorkTypes[role]?.includes(workType) ?? true
}

/** Checks medium compatibility. Identity validation is separate. */
export function canUseWorkRelation(type: WorkRelationType, from: WorkType, to: WorkType): boolean {
  if (['remake', 'remakeSource', 'remaster', 'remasterSource'].includes(type)) {
    return from === to
  }
  if (['port', 'portSource', 'expansion', 'baseGame'].includes(type)) {
    return from === 'game' && to === 'game'
  }

  return true
}

const inverse: Readonly<Record<WorkRelationType, WorkRelationType>> = {
  sequel: 'prequel',
  prequel: 'sequel',

  sideStory: 'mainStory',
  mainStory: 'sideStory',

  spinOff: 'spinOffOrigin',
  spinOffOrigin: 'spinOff',

  summary: 'fullStory',
  fullStory: 'summary',

  adaptation: 'sourceMaterial',
  sourceMaterial: 'adaptation',

  remake: 'remakeSource',
  remakeSource: 'remake',

  remaster: 'remasterSource',
  remasterSource: 'remaster',

  port: 'portSource',
  portSource: 'port',

  expansion: 'baseGame',
  baseGame: 'expansion',

  compilation: 'includedWork',
  includedWork: 'compilation',

  alternativeVersion: 'alternativeVersion',
  related: 'related',
}

/** Directions normalized by swapping endpoints into their canonical stored form. */
const reverseTypes: readonly WorkRelationType[] = [
  'prequel',
  'mainStory',
  'spinOffOrigin',
  'fullStory',
  'sourceMaterial',
  'remakeSource',
  'remasterSource',
  'portSource',
  'baseGame',
  'includedWork',
]

export function reverseWorkRelationType(type: WorkRelationType): WorkRelationType {
  return inverse[type]
}

/** Checks that parsed endpoints have distinct identities and support the selected relationship. */
export function validateWorkRelation(value: WorkRelationBinding): void {
  if (value.from.id === value.to.id) {
    throw new DesktopError('InvalidInput', 'A work cannot relate to itself')
  }
  if (!canUseWorkRelation(value.type, value.from.type, value.to.type)) {
    throw new DesktopError('InvalidInput', 'Work relation does not support these media')
  }
}

/** Converts a validated binding to storage direction, ordering symmetric endpoints by identity. */
export function canonicalWorkRelation(value: WorkRelationBinding): StoredWorkRelationBinding {
  const symmetric = value.type === 'related' || value.type === 'alternativeVersion'
  const swap =
    reverseTypes.includes(value.type) ||
    (symmetric && compareIdentityText(value.from.id, value.to.id) > 0)
  return {
    from: swap ? value.to : value.from,
    to: swap ? value.from : value.to,
    type: (swap ? inverse[value.type] : value.type) as StoredWorkRelationType,
  }
}

export function normalizeWorkRelation(input: WorkRelationBinding): StoredWorkRelationBinding {
  const value = parseValue(
    v.strictObject(workRelationBindingEntries),
    input,
    'Invalid work relation',
  )
  validateWorkRelation(value)
  return canonicalWorkRelation(value)
}

/** The nullable role must be supplied explicitly. */
export function parseWorkCharacterCreate(input: unknown): WorkCharacterCreate {
  return parseValue(
    v.strictObject({ ...workCharacterBindingEntries, ...optionalFields(relationPropertyEntries) }),
    input,
    'Invalid work character relation',
  )
}

export function parseWorkCharacterBinding(input: unknown): WorkCharacterBinding {
  return parseValue(
    v.strictObject(workCharacterBindingEntries),
    input,
    'Invalid work character binding',
  )
}

export function parsePersonWorkBinding(input: unknown): PersonWorkBinding {
  const value = parseValue(
    v.strictObject(personWorkBindingEntries),
    input,
    'Invalid person work binding',
  )
  if (!canUsePersonRole(value.role, value.work.type, value.character !== null)) {
    throw new DesktopError('InvalidInput', 'Person role is not applicable to this binding')
  }

  return value as PersonWorkBinding
}

export function parseOrganizationWorkBinding(input: unknown): OrganizationWorkBinding {
  const value = parseValue(
    v.strictObject(organizationWorkBindingEntries),
    input,
    'Invalid organization work binding',
  )
  if (!canUseOrganizationRole(value.role, value.work.type)) {
    throw new DesktopError('InvalidInput', 'Organization role is not applicable to this binding')
  }

  return value as OrganizationWorkBinding
}

/**
 * Provide the canonical storage direction for the baseline, including when viewing the opposite
 * endpoint.
 */
export function parseStoredWorkRelationBinding(input: unknown): StoredWorkRelationBinding {
  const value = parseValue(
    v.strictObject(workRelationBindingEntries),
    input,
    'Invalid stored work relation binding',
  )
  validateWorkRelation(value)
  const normalized = canonicalWorkRelation(value)
  if (normalized.type !== value.type || normalized.from.id !== value.from.id) {
    throw new DesktopError('InvalidInput', 'Expected work relation binding must be canonical')
  }

  return normalized
}

export function parsePersonWorkCreate(input: unknown): PersonWorkCreate {
  const value = parseValue(
    v.strictObject({ ...personWorkBindingEntries, ...optionalFields(relationPropertyEntries) }),
    input,
    'Invalid person work relation',
  )
  if (!canUsePersonRole(value.role, value.work.type, value.character !== null)) {
    throw new DesktopError(
      'InvalidInput',
      'Person role is not applicable to this work or character scope',
    )
  }

  return value as PersonWorkCreate
}

export function parseOrganizationWorkCreate(input: unknown): OrganizationWorkCreate {
  const value = parseValue(
    v.strictObject({
      ...organizationWorkBindingEntries,
      ...optionalFields(relationPropertyEntries),
    }),
    input,
    'Invalid organization work relation',
  )
  if (!canUseOrganizationRole(value.role, value.work.type)) {
    throw new DesktopError('InvalidInput', 'Organization role is not applicable to this work type')
  }

  return value as OrganizationWorkCreate
}

/** Parses and validates work-relation creation while retaining the caller's stated direction. */
export function parseWorkRelationCreate(input: unknown): WorkRelationCreate {
  const value = parseValue(
    v.strictObject({ ...workRelationBindingEntries, note: v.exactOptional(v.nullable(text)) }),
    input,
    'Invalid work relation',
  )
  validateWorkRelation(value)
  return value
}

function updateSchema<T extends v.ObjectEntries, B extends v.GenericSchema>(
  entries: T,
  binding: B,
  spoiler: boolean,
) {
  const properties = { note: v.nullable(text), isSpoiler: spoiler ? v.boolean() : v.never() }
  return v.strictObject({
    changes: v.strictObject(optionalFields({ ...entries, ...properties })),
    expected: v.exactOptional(
      v.strictObject({ ...optionalFields(properties), binding: v.exactOptional(binding) }),
    ),
  })
}

/**
 * A supplied binding baseline describes the complete original association and can supply context
 * for an attribute edit.
 */
export function parseWorkCharacterUpdate(input: unknown): WorkCharacterUpdate {
  const value = parseValue(
    updateSchema(workCharacterBindingEntries, v.strictObject(workCharacterBindingEntries), true),
    input,
  )
  validateExpectedKeys(value.changes, value.expected, ['binding'])
  return value
}

/**
 * Checks role constraints when the input establishes the binding. Commit completes an incomplete
 * binding from current state.
 */
export function parsePersonWorkUpdate(input: unknown): PersonWorkUpdate {
  const binding = fromParser(parsePersonWorkBinding)
  const value = parseValue(updateSchema(personWorkBindingEntries, binding, true), input)
  validateExpectedKeys(value.changes, value.expected, ['binding'])
  const final = { ...value.expected?.binding, ...value.changes }
  if (
    final.work &&
    final.role &&
    final.character !== undefined &&
    !canUsePersonRole(final.role, final.work.type, final.character !== null)
  ) {
    throw new DesktopError('InvalidInput', 'Person role is not applicable to the edited binding')
  }

  return value
}

/**
 * Checks applicability when work and role are known. Commit fills gaps in the binding from current
 * state.
 */
export function parseOrganizationWorkUpdate(input: unknown): OrganizationWorkUpdate {
  const binding = fromParser(parseOrganizationWorkBinding)
  const value = parseValue(updateSchema(organizationWorkBindingEntries, binding, true), input)
  validateExpectedKeys(value.changes, value.expected, ['binding'])
  const final = { ...value.expected?.binding, ...value.changes }
  if (final.work && final.role && !canUseOrganizationRole(final.role, final.work.type)) {
    throw new DesktopError(
      'InvalidInput',
      'Organization role is not applicable to the edited binding',
    )
  }

  return value
}

/**
 * Validates a complete binding when supplied. The original binding uses canonical storage
 * direction.
 */
export function parseWorkRelationUpdate(input: unknown): WorkRelationUpdate {
  const binding = fromParser(parseStoredWorkRelationBinding)
  const value = parseValue(updateSchema(workRelationBindingEntries, binding, false), input)
  validateExpectedKeys(value.changes, value.expected, ['binding'])
  const final = { ...value.expected?.binding, ...value.changes }
  if (final.from && final.to && final.type) {
    validateWorkRelation({ from: final.from, to: final.to, type: final.type })
  }
  return value
}
