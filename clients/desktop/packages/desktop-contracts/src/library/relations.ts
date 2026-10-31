/** @fileoverview Defines four catalog facts, role applicability, and canonical work-relation direction. */

import * as v from 'valibot'
import { objectSchema } from '../schema'
import type { CallOptions, ListOptions, ListResult } from '../execution'
import {
  exactPartialEntries,
  hasRelatedExpected,
  nonemptyStringSchema,
  parseContract,
} from '../validation'
import { workRefSchema, type EntryRef, type WorkRef, type WorkType } from './identity'
import type { MoveInput, OrderChange } from './ordering'

/** A character's explicit classification within one work; null is an existing unclassified link. */
export const characterRoles = ['main', 'supporting', 'cameo', 'other'] as const
export type CharacterRole = (typeof characterRoles)[number]
export const personRoles = [
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
] as const
export type PersonRole = (typeof personRoles)[number]
export const organizationRoles = [
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
] as const
export type OrganizationRole = (typeof organizationRoles)[number]
export const canonicalWorkRelationTypes = [
  'sequel',
  'sideStory',
  'spinOff',
  'summary',
  'adaptation',
  'remake',
  'remaster',
  'port',
  'expansion',
  'compilation',
  'alternativeVersion',
  'related',
] as const
export const workRelationTypes = [
  ...canonicalWorkRelationTypes,
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
] as const
export type CanonicalWorkRelationType = (typeof canonicalWorkRelationTypes)[number]
export type WorkRelationType = (typeof workRelationTypes)[number]

const allWorks = ['game', 'anime', 'comic', 'novel'] as const
const audiovisual = ['game', 'anime'] as const
const illustrated = ['game', 'anime', 'comic'] as const
/** Exact role scopes, reused by forms, pure validation, and transactional owners. */
export const personRoleWorkTypes = {
  creator: allWorks,
  characterCreator: allWorks,
  originalCreator: allWorks,
  director: audiovisual,
  scenario: illustrated,
  seriesComposition: ['anime'],
  direction: audiovisual,
  storyboard: illustrated,
  characterDesign: allWorks,
  illustration: allWorks,
  drawing: illustrated,
  animationDirector: audiovisual,
  art: allWorks,
  photography: audiovisual,
  sound: audiovisual,
  music: audiovisual,
  programmer: ['game'],
  producer: audiovisual,
  publisher: allWorks,
  translator: allWorks,
  editor: allWorks,
  voiceActor: audiovisual,
  other: allWorks,
} as const satisfies Record<PersonRole, readonly WorkType[]>
export const organizationRoleWorkTypes = {
  creator: allWorks,
  originalCreator: allWorks,
  developer: ['game'],
  studio: audiovisual,
  producer: audiovisual,
  music: audiovisual,
  sound: audiovisual,
  publisher: allWorks,
  distributor: allWorks,
  imprint: ['comic', 'novel'],
  localization: allWorks,
  other: allWorks,
} as const satisfies Record<OrganizationRole, readonly WorkType[]>
export const characterScopedPersonRoles = [
  'characterCreator',
  'characterDesign',
  'drawing',
  'illustration',
  'voiceActor',
  'other',
] as const

export const characterRefSchema = objectSchema({
  type: v.literal('character'),
  id: nonemptyStringSchema,
})
export const personRefSchema = objectSchema({ type: v.literal('person'), id: nonemptyStringSchema })
export const organizationRefSchema = objectSchema({
  type: v.literal('organization'),
  id: nonemptyStringSchema,
})
const workCharacterFields = {
  work: workRefSchema,
  character: characterRefSchema,
  role: v.nullable(v.picklist(characterRoles)),
}
const personWorkFields = {
  work: workRefSchema,
  person: personRefSchema,
  character: v.nullable(characterRefSchema),
  role: v.picklist(personRoles),
}
const organizationWorkFields = {
  work: workRefSchema,
  organization: organizationRefSchema,
  role: v.picklist(organizationRoles),
}
const workRelationFields = {
  from: workRefSchema,
  to: workRefSchema,
  type: v.picklist(workRelationTypes),
}
export const workCharacterBindingSchema = objectSchema(workCharacterFields)
export const personWorkBindingSchema = v.pipe(
  objectSchema(personWorkFields),
  v.check((value) => isPersonRoleAllowed(value.role, value.work.type, value.character !== null)),
)
export const organizationWorkBindingSchema = v.pipe(
  objectSchema(organizationWorkFields),
  v.check((value) => isOrganizationRoleAllowed(value.role, value.work.type)),
)
export const workRelationBindingSchema = v.pipe(
  objectSchema(workRelationFields),
  v.check((value) => isWorkRelationAllowed(value)),
)

/** Complete endpoints and role of one character-to-work fact. */
export interface WorkCharacterBinding {
  readonly work: WorkRef
  readonly character: EntryRef<'character'>
  readonly role: CharacterRole | null
}
/** Complete endpoints and duty of one person-to-work fact; a nullable character is always explicit. */
export interface PersonWorkBinding {
  readonly work: WorkRef
  readonly person: EntryRef<'person'>
  readonly character: EntryRef<'character'> | null
  readonly role: PersonRole
}
/** Complete endpoints and duty of one organization-to-work fact. */
export interface OrganizationWorkBinding {
  readonly work: WorkRef
  readonly organization: EntryRef<'organization'>
  readonly role: OrganizationRole
}
/** A user-facing direction; normalization maps reverse names to a single stored fact. */
export interface WorkRelationBinding {
  readonly from: WorkRef
  readonly to: WorkRef
  readonly type: WorkRelationType
}

/** The facts compared during relation editing; order is owned separately by each actual side. */
export interface RelationBindings {
  readonly workCharacters: WorkCharacterBinding
  readonly personWorks: PersonWorkBinding
  readonly organizationWorks: OrganizationWorkBinding
  readonly workRelations: WorkRelationBinding
}
export type RelationKind = keyof RelationBindings
/** Stable identity of one fact, not the identity of a row's displayed person or work. */
export interface RelationRef<Type extends RelationKind = RelationKind> {
  readonly type: Type
  readonly id: string
}
/** Saved relation attributes and endpoints, retaining the same ID in both reading directions. */
export type RelationSnapshot<Type extends RelationKind = RelationKind> = {
  [Kind in Type]: {
    readonly id: string
    readonly binding: RelationBindings[Kind]
    readonly note: string | null
  } & (Kind extends 'workRelations' ? object : { readonly isSpoiler: boolean })
}[Type]
/** New relation attributes default to null/false; endpoints and role/type remain explicit. */
export type RelationCreate<Type extends RelationKind> = RelationBindings[Type] & {
  readonly note?: string | null
} & (Type extends 'workRelations' ? object : { readonly isSpoiler?: boolean })
/** Partial changes retain identity; binding is a contextual full baseline even for a note-only edit. */
export interface RelationUpdate<Type extends RelationKind> {
  readonly changes: Partial<RelationCreate<Type>>
  readonly expected?: {
    readonly binding?: RelationBindings[Type]
    readonly note?: string | null
  } & (Type extends 'workRelations' ? object : { readonly isSpoiler?: boolean })
}

/** Only actual list owners can arrange facts; each side maintains its own independent order. */
export interface RelationScopes {
  readonly workCharacters:
    | { readonly type: 'work'; readonly work: WorkRef }
    | { readonly type: 'character'; readonly characterId: string }
  readonly personWorks:
    | { readonly type: 'work'; readonly work: WorkRef }
    | { readonly type: 'person'; readonly personId: string }
    | { readonly type: 'character'; readonly characterId: string }
  readonly organizationWorks:
    | { readonly type: 'work'; readonly work: WorkRef }
    | { readonly type: 'organization'; readonly organizationId: string }
  readonly workRelations: { readonly work: WorkRef }
}

/** Complete operations for one of the four fact families, with explicit scope and stable relation IDs. */
export interface RelationApi<Type extends RelationKind> {
  /** Return actual fact rows and total in the requested side's order. */
  list(
    scope: RelationScopes[Type],
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<RelationSnapshot<Type>>>
  /** Return null when the actual fact is not ordinarily visible or no longer exists. */
  get(id: string, call?: CallOptions): Promise<RelationSnapshot<Type> | null>
  /** Create one fact; an existing business key is Conflict, never an implicit merge. */
  create(input: RelationCreate<Type>, call?: CallOptions): Promise<string>
  /** Keep the ID, verify binding and changed baselines, and commit required dependent changes together. */
  update(id: string, input: RelationUpdate<Type>, call?: CallOptions): Promise<void>
  /** Remove facts, including dependent character work when removing its work-character link. */
  delete(ids: string | readonly string[], call?: CallOptions): Promise<void>
  /** Change only the specified side's order after comparing its entire original sequence. */
  reorder(scope: RelationScopes[Type], input: OrderChange, call?: CallOptions): Promise<void>
  /** Apply a current-position intent to this side; never infer an anchor from filtered pixels. */
  move(scope: RelationScopes[Type], input: MoveInput, call?: CallOptions): Promise<void>
}
/** The four supported structural relations; personal and file memberships have their own APIs. */
export interface RelationsApi {
  readonly workCharacters: RelationApi<'workCharacters'>
  readonly personWorks: RelationApi<'personWorks'>
  readonly organizationWorks: RelationApi<'organizationWorks'>
  readonly workRelations: RelationApi<'workRelations'>
}

/** Check the precise duty/media/character combination without inferring relationships. */
export function isPersonRoleAllowed(
  role: PersonRole,
  workType: WorkType,
  hasCharacter: boolean,
): boolean {
  const types: readonly WorkType[] = personRoleWorkTypes[role]
  const scoped: readonly PersonRole[] = characterScopedPersonRoles
  return types.includes(workType) && (!hasCharacter || scoped.includes(role))
}
/** Check only the declared organization duty and medium; no organization metadata is inferred. */
export function isOrganizationRoleAllowed(role: OrganizationRole, workType: WorkType): boolean {
  const types: readonly WorkType[] = organizationRoleWorkTypes[role]
  return types.includes(workType)
}
/** Check self-links and the few relation kinds with explicit medium restrictions. */
export function isWorkRelationAllowed(binding: {
  readonly from: WorkRef
  readonly to: WorkRef
  readonly type: WorkRelationType
}): boolean {
  if (binding.from.id === binding.to.id) {
    return false
  }
  if (['port', 'portSource', 'expansion', 'baseGame'].includes(binding.type)) {
    return binding.from.type === 'game' && binding.to.type === 'game'
  }
  return (
    !['remake', 'remakeSource', 'remaster', 'remasterSource'].includes(binding.type) ||
    binding.from.type === binding.to.type
  )
}

/** Normalize direction and symmetric endpoint byte order; names and metadata never determine identity. */
export function normalizeWorkRelation(input: WorkRelationBinding): {
  readonly from: WorkRef
  readonly to: WorkRef
  readonly type: CanonicalWorkRelationType
} {
  const value = parseContract(workRelationBindingSchema, input, 'work relation')
  const reverse = {
    prequel: 'sequel',
    mainStory: 'sideStory',
    spinOffOrigin: 'spinOff',
    fullStory: 'summary',
    sourceMaterial: 'adaptation',
    remakeSource: 'remake',
    remasterSource: 'remaster',
    portSource: 'port',
    baseGame: 'expansion',
    includedWork: 'compilation',
  } as const
  if (Object.hasOwn(reverse, value.type)) {
    return { from: value.to, to: value.from, type: reverse[value.type as keyof typeof reverse] }
  }
  const type = parseContract(
    v.picklist(canonicalWorkRelationTypes),
    value.type,
    'canonical relation type',
  )
  const swap =
    (type === 'alternativeVersion' || type === 'related') &&
    compareUtf8(value.from.id, value.to.id) > 0
  return { from: swap ? value.to : value.from, to: swap ? value.from : value.to, type }
}

const bindingSchemas: { [Type in RelationKind]: v.GenericSchema<unknown, RelationBindings[Type]> } =
  {
    workCharacters: workCharacterBindingSchema,
    personWorks: personWorkBindingSchema,
    organizationWorks: organizationWorkBindingSchema,
    workRelations: workRelationBindingSchema,
  }
const attributes = { note: v.nullable(v.string()), isSpoiler: v.boolean() }
export const relationUpdateSchemas: {
  [Type in RelationKind]: v.GenericSchema<unknown, RelationUpdate<Type>>
} = {
  workCharacters: relationUpdateSchema(workCharacterFields, workCharacterBindingSchema, attributes),
  personWorks: relationUpdateSchema(personWorkFields, personWorkBindingSchema, attributes),
  organizationWorks: relationUpdateSchema(
    organizationWorkFields,
    organizationWorkBindingSchema,
    attributes,
  ),
  workRelations: relationUpdateSchema(workRelationFields, workRelationBindingSchema, {
    note: attributes.note,
  }),
}

/** Validate all required binding values and their role/media restrictions. */
export function parseRelationBinding<Type extends RelationKind>(
  type: Type,
  input: unknown,
): RelationBindings[Type] {
  return parseContract(bindingSchemas[type], input, 'relation binding')
}

/** Parse a closed edit shape; the transaction validates the resulting complete binding. */
export function parseRelationUpdate<Type extends RelationKind>(
  type: Type,
  input: unknown,
): RelationUpdate<Type> {
  return parseContract(relationUpdateSchemas[type], input, 'relation update')
}

function relationUpdateSchema<
  Entries extends v.ObjectEntries,
  Schema extends v.GenericSchema,
  Attributes extends v.ObjectEntries,
>(entries: Entries, binding: Schema, attributes: Attributes) {
  return v.pipe(
    objectSchema({
      changes: objectSchema(exactPartialEntries({ ...entries, ...attributes })),
      expected: v.exactOptional(
        objectSchema({ binding: v.exactOptional(binding), ...exactPartialEntries(attributes) }),
      ),
    }),
    v.check(
      (value) =>
        value.changes !== undefined &&
        hasRelatedExpected(value.changes, value.expected, ['binding']),
    ),
  )
}

function compareUtf8(left: string, right: string): number {
  const encoder = new TextEncoder()
  const a = encoder.encode(left)
  const b = encoder.encode(right)
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    if (a[index] !== b[index]) {
      return a[index]! < b[index]! ? -1 : 1
    }
  }
  return a.length - b.length
}
