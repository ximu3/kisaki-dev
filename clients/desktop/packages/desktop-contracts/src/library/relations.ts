/** @fileoverview Defines the four catalog relations, exact participation constraints and one canonical work-relation direction. */

import type { WorkType, WorkRef, EntryRef } from './catalog'
import type { ListOptions, CallOptions, ListResult } from '../operations'
import type { ReorderInput, MoveInput } from './ordering'
import * as v from 'valibot'
import { id, text, parseValue, optionalFields, validateExpectedKeys } from '../validation'
import { workRefSchema } from './catalog'
import { DesktopError } from '../errors'
import { compareIdentityText } from '../scalar-order'

/** Role in this work; null means an existing association whose importance is not classified. */
export const characterRoles = Object.freeze(['main', 'supporting', 'cameo', 'other'] as const)

/** Character's narrative importance within a particular work. */
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

/** Credited responsibility held by a person in a particular work. */
export type PersonRole = (typeof personRoles)[number]

/** Credited organization responsibilities with per-medium compatibility owned by this module. */
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

/** Credited responsibility held by an organization in a particular work. */
export type OrganizationRole = (typeof organizationRoles)[number]

/** Person responsibility that can be qualified by a specific character. */
export type CharacterPersonRole =
  'characterCreator' | 'characterDesign' | 'drawing' | 'illustration' | 'voiceActor' | 'other'

/** Person responsibility applicable to every work medium. */
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

/** Person responsibility shared by games and anime. */
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

/** Person responsibilities permitted for the selected work medium. */
export type PersonRoleFor<T extends WorkType> =
  | CommonPersonRole
  | (T extends 'game'
      ? AudiovisualPersonRole | 'programmer'
      : T extends 'anime'
        ? AudiovisualPersonRole | 'seriesComposition'
        : T extends 'comic'
          ? 'scenario' | 'storyboard' | 'drawing'
          : never)

/** Organization responsibilities permitted for the selected work medium. */
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
 * Note and spoiler status belonging to a relation itself.
 *
 * These attributes are independent of entry descriptions and global sensitivity flags.
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
 * Person's credited responsibility in a work, optionally qualified by a character.
 *
 * A character-qualified binding requires the corresponding work-character association to exist at
 * commit.
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

/** Relationship between works as viewed from one endpoint. */
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

/** Pair of work endpoints and their relationship in the caller's stated direction. */
export interface WorkRelationBinding {
  readonly from: WorkRef
  readonly to: WorkRef
  readonly type: WorkRelationType
}

/**
 * Work relation in canonical storage direction.
 *
 * Endpoint ordering is independent of either side's display order.
 */
export interface StoredWorkRelationBinding extends WorkRelationBinding {
  readonly type: StoredWorkRelationType
}

/**
 * Saved work-character association with relation attributes and a stable ID.
 *
 * Changing its binding retains that ID.
 */
export interface WorkCharacter extends WorkCharacterBinding, RelationProperties {
  readonly id: string
}

/** Saved credited person responsibility with relation attributes and a stable ID. */
export type PersonWork = PersonWorkBinding & RelationProperties & { readonly id: string }

/** Saved credited organization responsibility with relation attributes and a stable ID. */
export type OrganizationWork = OrganizationWorkBinding &
  RelationProperties & { readonly id: string }

/** Saved canonical work relation with its own note and stable ID. */
export interface WorkRelation extends StoredWorkRelationBinding {
  readonly id: string
  readonly note: string | null
}

/**
 * Input for a new work-character association.
 *
 * The binding explicitly includes its nullable role; omitted note and spoiler attributes default to
 * null and false.
 */
export type WorkCharacterCreate = WorkCharacterBinding & Partial<RelationProperties>

/** Input for a new credited person responsibility with optional note and spoiler attributes. */
export type PersonWorkCreate = PersonWorkBinding & Partial<RelationProperties>

/**
 * Input for a new credited organization responsibility with optional note and spoiler attributes.
 */
export type OrganizationWorkCreate = OrganizationWorkBinding & Partial<RelationProperties>

/** Input for a new work relation in either viewing direction, with an optional note. */
export type WorkRelationCreate = WorkRelationBinding & { readonly note?: string | null }

/**
 * Work-character edits with optional original attribute values and a complete binding baseline.
 *
 * The binding baseline compares the whole original association even when only its note is edited.
 */
export interface WorkCharacterUpdate {
  readonly changes: Partial<WorkCharacterBinding & RelationProperties>
  readonly expected?: Partial<RelationProperties> & { readonly binding?: WorkCharacterBinding }
}

/**
 * Person-responsibility edits with optional original attributes and a complete binding baseline.
 */
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

/**
 * Organization-responsibility edits with optional original attributes and a complete binding
 * baseline.
 */
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

/** Work-relation edits with an optional original note and canonical binding baseline. */
export interface WorkRelationUpdate {
  readonly changes: Partial<WorkRelationBinding & { readonly note: string | null }>
  readonly expected?: {
    readonly binding?: StoredWorkRelationBinding
    readonly note?: string | null
  }
}

/** Work or character side whose actual association rows are listed or ordered. */
export type WorkCharacterScope =
  | { readonly side: 'work'; readonly work: WorkRef }
  | { readonly side: 'character'; readonly characterId: string }

/** Work, person or character side whose credited person relations are listed or ordered. */
export type PersonWorkScope =
  | { readonly side: 'work'; readonly work: WorkRef }
  | { readonly side: 'person'; readonly personId: string }
  | { readonly side: 'character'; readonly characterId: string }

/** Work or organization side whose credited organization relations are listed or ordered. */
export type OrganizationWorkScope =
  | { readonly side: 'work'; readonly work: WorkRef }
  | { readonly side: 'organization'; readonly organizationId: string }

/** Canonical from or to side whose work relations are listed or ordered. */
export type WorkRelationScope = { readonly side: 'from' | 'to'; readonly work: WorkRef }

/** Shared operations specialized by each relation family's scope, stored fact and write inputs. */
interface RelationApi<Scope, Fact, Create, Update> {
  /** Reads an interval of actual relation rows in the selected side's formal order. */
  list(scope: Scope, options: ListOptions, call?: CallOptions): Promise<ListResult<Fact>>

  /** Reads a relation by its stable ID, returning null when it does not exist. */
  get(id: string, call?: CallOptions): Promise<Fact | null>

  /**
   * Creates a relation and returns its stable ID.
   *
   * Duplicate creation reports Conflict; writeGraph's explicit add operation defines separate
   * idempotent semantics.
   */
  create(input: Create, call?: CallOptions): Promise<string>

  /**
   * Commits relation edits after checking supplied baselines and the resulting binding's
   * constraints.
   */
  update(id: string, input: Update, call?: CallOptions): Promise<void>

  /** Deletes the identified relation and its associated ordering entries. */
  delete(id: string, call?: CallOptions): Promise<void>

  /** Reorders selected relation rows against the complete order baseline for the selected side. */
  reorder(scope: Scope, input: ReorderInput, call?: CallOptions): Promise<void>

  /** Moves selected relation rows to a requested position in the selected side's order. */
  move(scope: Scope, input: MoveInput, call?: CallOptions): Promise<void>
}

/**
 * Catalog operations for work-character, person-work, organization-work and work-work relations.
 */
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

/** Typed reference to an independently identified character entry. */
export const characterRefSchema = v.strictObject({ type: v.literal('character'), id })

/** Typed reference to an independently identified person entry. */
export const personRefSchema = v.strictObject({ type: v.literal('person'), id })

/** Typed reference to an independently identified organization entry. */
export const organizationRefSchema = v.strictObject({ type: v.literal('organization'), id })

/** Editable participation notes and spoiler state, separate from endpoint identity. */
export const relationPropertyEntries = { note: v.nullable(text), isSpoiler: v.boolean() }

/** Work-character endpoints and optional character role for one association. */
export const workCharacterBindingEntries = {
  work: workRefSchema,
  character: characterRefSchema,
  role: v.nullable(v.picklist(characterRoles)),
}

/** Credited person responsibility with an optional character endpoint in the same work. */
export const personWorkBindingEntries = {
  work: workRefSchema,
  person: personRefSchema,
  character: v.nullable(characterRefSchema),
  role: v.picklist(personRoles),
}

/** Credited organization responsibility for one work endpoint. */
export const organizationWorkBindingEntries = {
  work: workRefSchema,
  organization: organizationRefSchema,
  role: v.picklist(organizationRoles),
}

/** Two work endpoints and a relation direction as expressed by the caller. */
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

/** Person responsibilities that may carry a character endpoint. */
const characterPersonRoles: readonly PersonRole[] = [
  'characterCreator',
  'characterDesign',
  'drawing',
  'illustration',
  'voiceActor',
  'other',
]

/** Checks a parsed person role's medium and character-qualification constraints. */
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

/** Checks a parsed organization role's applicability to a work medium. */
export function canUseOrganizationRole(role: OrganizationRole, workType: WorkType): boolean {
  return organizationRoleWorkTypes[role]?.includes(workType) ?? true
}

/**
 * Checks the permitted medium combination for a parsed work-relation type.
 *
 * Endpoint identity is checked separately.
 */
export function canUseWorkRelation(type: WorkRelationType, from: WorkType, to: WorkType): boolean {
  if (['remake', 'remakeSource', 'remaster', 'remasterSource'].includes(type)) {
    return from === to
  }
  if (['port', 'portSource', 'expansion', 'baseGame'].includes(type)) {
    return from === 'game' && to === 'game'
  }

  return true
}

/** Opposite-endpoint names for every supported work-relation direction. */
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

/** Returns the relationship kind seen from the opposite endpoint of the same fact. */
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

/** Parses and validates a work-relation binding, then returns its canonical storage direction. */
export function normalizeWorkRelation(input: WorkRelationBinding): StoredWorkRelationBinding {
  const value = parseValue(
    v.strictObject(workRelationBindingEntries),
    input,
    'Invalid work relation',
  )
  validateWorkRelation(value)
  return canonicalWorkRelation(value)
}

/**
 * Parses a complete work-character binding and optional relation attributes.
 *
 * The nullable role must be supplied explicitly.
 */
export function parseWorkCharacterCreate(input: unknown): WorkCharacterCreate {
  return parseValue(
    v.strictObject({ ...workCharacterBindingEntries, ...optionalFields(relationPropertyEntries) }),
    input,
    'Invalid work character relation',
  )
}

/** Parses a complete work-character binding independently of note and spoiler attributes. */
export function parseWorkCharacterBinding(input: unknown): WorkCharacterBinding {
  return parseValue(
    v.strictObject(workCharacterBindingEntries),
    input,
    'Invalid work character binding',
  )
}

/** Parses a complete person responsibility and checks its medium and character constraints. */
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

/** Parses a complete organization responsibility and checks its work-medium constraint. */
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
 * Parses a binding baseline and requires canonical storage direction.
 *
 * Forms viewing the opposite endpoint must still supply the canonical baseline.
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

/**
 * Parses a new person responsibility and its attributes, checking medium and character constraints.
 */
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

/**
 * Parses a new organization responsibility and its attributes, checking work-medium applicability.
 */
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

/**
 * Creates an edit schema with partial changes, an optional complete binding baseline and permitted
 * attributes.
 */
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
 * Parses association edits and their attribute baselines.
 *
 * A supplied binding baseline remains a complete original association and may serve as context for
 * any edit.
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
 * Parses person-responsibility edits and checks role constraints when the supplied values determine
 * them.
 *
 * Commit-time validation completes the binding from current state.
 */
export function parsePersonWorkUpdate(input: unknown): PersonWorkUpdate {
  const binding = v.pipe(v.unknown(), v.transform(parsePersonWorkBinding))
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
 * Parses organization-responsibility edits and checks applicability when the supplied work and role
 * are known.
 *
 * Commit-time validation completes an incomplete binding from current state.
 */
export function parseOrganizationWorkUpdate(input: unknown): OrganizationWorkUpdate {
  const binding = v.pipe(v.unknown(), v.transform(parseOrganizationWorkBinding))
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
 * Parses work-relation edits and validates any complete resulting binding available from the input.
 *
 * The optional original binding must use canonical storage direction.
 */
export function parseWorkRelationUpdate(input: unknown): WorkRelationUpdate {
  const binding = v.pipe(v.unknown(), v.transform(parseStoredWorkRelationBinding))
  const value = parseValue(updateSchema(workRelationBindingEntries, binding, false), input)
  validateExpectedKeys(value.changes, value.expected, ['binding'])
  const final = { ...value.expected?.binding, ...value.changes }
  if (final.from && final.to && final.type) {
    validateWorkRelation({ from: final.from, to: final.to, type: final.type })
  }
  return value
}
