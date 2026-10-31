/** @fileoverview Defines reusable metadata profiles, typed field selection, and whole-definition validation. */

import * as v from 'valibot'
import type { DefinitionRead } from '../definition'
import { invalidInput } from '../errors'
import type { CallOptions, Disposable } from '../execution'
import type { EntryType, PartType } from '../library/identity'
import type { OrderChange } from '../library/ordering'
import { objectSchema } from '../schema'
import { exactPartialEntries, nonemptyStringSchema, parseContract } from '../validation'
import {
  metadataEntryFields,
  metadataPartFields,
  type MetadataEntryValuesByType,
  type MetadataPartValuesByType,
} from './fields'
import { metadataMatchingSchemas, type MetadataMatching } from './matching'
import {
  metadataRelationKeys,
  type MetadataRelationAttributes,
  type MetadataRelationKey,
} from './relations'

/** Selection follows configured source order; only collection values support union. */
export interface MetadataFieldRule<Value> {
  readonly providers: readonly string[]
  readonly selection:
    'first' | 'firstNonEmpty' | (Value extends readonly unknown[] ? 'union' : never)
  readonly processors?: readonly string[]
}
export type MetadataEntryFieldRules<Type extends EntryType> = {
  [Kind in Type]: {
    readonly [Field in keyof MetadataEntryValuesByType[Kind]]?: MetadataFieldRule<
      MetadataEntryValuesByType[Kind][Field]
    >
  }
}[Type]
export type MetadataPartFieldRules<Type extends PartType> = {
  [Kind in Type]: {
    readonly [Field in keyof MetadataPartValuesByType[Kind]]?: MetadataFieldRule<
      MetadataPartValuesByType[Kind][Field]
    >
  }
}[Type]
type PartFieldRules<Type extends EntryType> = {
  game: never
  anime: {
    readonly episode?: MetadataPartFieldRules<'animeEpisode'>
    readonly extra?: MetadataPartFieldRules<'animeExtra'>
  }
  comic: {
    readonly volume?: MetadataPartFieldRules<'comicVolume'>
    readonly chapter?: MetadataPartFieldRules<'comicChapter'>
  }
  novel: { readonly volume?: MetadataPartFieldRules<'novelVolume'> }
  character: never
  person: never
  organization: never
}[Type]
export interface MetadataProfileDefinition<Type extends EntryType = EntryType> {
  readonly providers: readonly string[]
  readonly matching: MetadataMatching<Type>
  readonly fields: {
    readonly entry?: MetadataEntryFieldRules<Type>
    readonly relatedEntries?: { readonly [Kind in EntryType]?: MetadataEntryFieldRules<Kind> }
    readonly parts?: PartFieldRules<Type>
    readonly tags?: {
      readonly description?: MetadataFieldRule<string | null>
      readonly isNsfw?: MetadataFieldRule<boolean>
    }
  }
  readonly relations: {
    readonly [Key in MetadataRelationKey<Type>]?: {
      readonly providers: readonly string[]
      readonly selection: 'first' | 'firstNonEmpty' | 'union'
    } & ([MetadataRelationAttributes[Key]] extends [never]
      ? { readonly fields?: never }
      : {
          readonly fields?: {
            readonly [Field in MetadataRelationAttributes[Key]]?: MetadataFieldRule<
              string | boolean | null
            >
          }
        })
  }
}
/** Saved definitions are visible even when invalid, but cannot execute or enter a repair baseline. */
export interface MetadataProfile<Type extends EntryType = EntryType> {
  readonly id: string
  readonly entryType: Type
  readonly name: string
  readonly description: string | null
  readonly preferredLanguages: readonly string[]
  readonly definition: DefinitionRead<MetadataProfileDefinition<Type>>
  readonly isDefault: boolean
  readonly sortOrder: number
  readonly createdAt: number
  readonly updatedAt: number
}
export type MetadataProfileSummary<Type extends EntryType = EntryType> = Omit<
  MetadataProfile<Type>,
  'definition'
>
export interface MetadataProfileChanges<Type extends EntryType> {
  readonly name?: string
  readonly description?: string | null
  readonly preferredLanguages?: readonly string[]
  readonly definition?: MetadataProfileDefinition<Type>
  readonly isDefault?: boolean
}
export type MetadataProfileCreate = {
  [Type in EntryType]: {
    readonly entryType: Type
    readonly name: string
    readonly definition: MetadataProfileDefinition<Type>
    readonly description?: string | null
    readonly preferredLanguages?: readonly string[]
    readonly isDefault?: boolean
    readonly expected?: { readonly defaultProfileId: string | null }
  }
}[EntryType]
export interface MetadataProfileUpdate<Type extends EntryType> {
  readonly changes: MetadataProfileChanges<Type>
  readonly expected?: MetadataProfileChanges<Type> & { readonly defaultProfileId?: string | null }
}
export interface MetadataProfilesApi {
  /** Read fixed, independent preset drafts; choosing one neither creates a profile nor selects a default. */
  listPresets(
    filter?: { readonly entryType?: EntryType; readonly language?: string },
    call?: CallOptions,
  ): Promise<readonly MetadataProfilePreset[]>
  /** Read configuration summaries in actual saved order; histories use their own paged reads. */
  list(
    filter?: { readonly entryType?: EntryType },
    call?: CallOptions,
  ): Promise<readonly MetadataProfileSummary[]>
  /** Read one saved profile, retaining invalid-definition state, or null when absent. */
  get(id: string, call?: CallOptions): Promise<MetadataProfile | null>
  /** Create an independent definition; selecting default replaces only the same type's default atomically. */
  create(input: MetadataProfileCreate, call?: CallOptions): Promise<MetadataProfile>
  /** Compare related fields, replace a complete legal definition, and save once; root type is immutable. */
  update(
    id: string,
    input: MetadataProfileUpdate<EntryType>,
    call?: CallOptions,
  ): Promise<MetadataProfile>
  /** Delete only when no persistent caller refers to the profile; existing admitted work retains its snapshot. */
  delete(id: string, call?: CallOptions): Promise<void>
  /** Reorder one type using its complete baseline, without changing its default selection. */
  reorder(input: { readonly entryType: EntryType } & OrderChange, call?: CallOptions): Promise<void>
  /** Observe saved-catalog changes, not source execution. */
  onInvalidated(listener: () => void): Disposable
}

/** A fixed catalog value copied into an ordinary new profile; its identity never becomes a live binding. */
export interface MetadataProfilePreset {
  readonly id: string
  readonly entryType: EntryType
  readonly language: string
  readonly name: string
  readonly description: string
  readonly preferredLanguages: readonly string[]
  readonly definition: MetadataProfileDefinition
  readonly requiredExtensionIds: readonly string[]
}

const references = v.pipe(
  v.array(nonemptyStringSchema),
  v.check((values) => new Set(values).size === values.length),
  v.readonly(),
)
const ruleSources = v.pipe(references, v.minLength(1))
const scalarRule = objectSchema({
  providers: ruleSources,
  selection: v.picklist(['first', 'firstNonEmpty']),
  processors: v.exactOptional(references),
})
const collectionRule = objectSchema({
  providers: ruleSources,
  selection: v.picklist(['first', 'firstNonEmpty', 'union']),
  processors: v.exactOptional(references),
})
function fieldRules<
  Entries extends v.ObjectEntries,
  const Collections extends readonly [
    Extract<keyof Entries, string>,
    ...Extract<keyof Entries, string>[],
  ],
>(fields: Entries, collections: Collections) {
  const scalarKeys = v.keyof(v.omit(v.strictObject(fields), collections)).options
  return objectSchema({
    ...v.entriesFromList(scalarKeys, v.exactOptional(scalarRule)),
    ...v.entriesFromList(collections, v.exactOptional(collectionRule)),
  })
}
const commonCollections = ['aliases', 'externalLinks', 'primaryImage'] as const
const workCollections = [
  ...commonCollections,
  'originalLanguages',
  'backdropImage',
  'titleLogo',
] as const
const entryRules = {
  game: fieldRules(metadataEntryFields.game, [...workCollections, 'iconImage']),
  anime: fieldRules(metadataEntryFields.anime, workCollections),
  comic: fieldRules(metadataEntryFields.comic, workCollections),
  novel: fieldRules(metadataEntryFields.novel, workCollections),
  character: fieldRules(metadataEntryFields.character, commonCollections),
  person: fieldRules(metadataEntryFields.person, commonCollections),
  organization: fieldRules(metadataEntryFields.organization, commonCollections),
}
const relatedRules = objectSchema(exactPartialEntries(entryRules))
const partRules = {
  anime: objectSchema(
    exactPartialEntries({
      episode: fieldRules(metadataPartFields.animeEpisode, commonCollections),
      extra: fieldRules(metadataPartFields.animeExtra, commonCollections),
    }),
  ),
  comic: objectSchema(
    exactPartialEntries({
      volume: fieldRules(metadataPartFields.comicVolume, commonCollections),
      chapter: fieldRules(metadataPartFields.comicChapter, commonCollections),
    }),
  ),
  novel: objectSchema(
    exactPartialEntries({ volume: fieldRules(metadataPartFields.novelVolume, commonCollections) }),
  ),
}
function relationRule<const Fields extends readonly string[]>(fields: Fields) {
  return objectSchema({
    providers: ruleSources,
    selection: v.picklist(['first', 'firstNonEmpty', 'union']),
    fields: v.exactOptional(objectSchema(v.entriesFromList(fields, v.exactOptional(scalarRule)))),
  })
}
const relationRules = v.strictObject(
  exactPartialEntries({
    workCharacters: relationRule(['role', 'note', 'isSpoiler']),
    personWorks: relationRule(['note', 'isSpoiler']),
    organizationWorks: relationRule(['note', 'isSpoiler']),
    workRelations: relationRule(['note']),
    entryTags: relationRule(['note', 'isSpoiler']),
    volumeChapters: relationRule(['numberLabel']),
    workVolumes: objectSchema({
      providers: ruleSources,
      selection: v.picklist(['first', 'firstNonEmpty', 'union']),
    }),
    workChapters: objectSchema({
      providers: ruleSources,
      selection: v.picklist(['first', 'firstNonEmpty', 'union']),
    }),
    workEpisodes: objectSchema({
      providers: ruleSources,
      selection: v.picklist(['first', 'firstNonEmpty', 'union']),
    }),
    workExtras: objectSchema({
      providers: ruleSources,
      selection: v.picklist(['first', 'firstNonEmpty', 'union']),
    }),
  }),
)
function profileDefinition<Entry, Parts, Matching, Relations>(
  entry: v.GenericSchema<unknown, Entry>,
  parts: v.GenericSchema<unknown, Parts>,
  matching: v.GenericSchema<unknown, Matching>,
  relations: v.GenericSchema<unknown, Relations>,
) {
  return objectSchema({
    providers: ruleSources,
    matching,
    fields: objectSchema({
      entry: v.exactOptional(entry),
      relatedEntries: v.exactOptional(relatedRules),
      parts: v.exactOptional(parts),
      tags: v.exactOptional(
        objectSchema({
          description: v.exactOptional(scalarRule),
          isNsfw: v.exactOptional(scalarRule),
        }),
      ),
    }),
    relations,
  })
}
const profileSchemas: {
  [Type in EntryType]: v.GenericSchema<unknown, MetadataProfileDefinition<Type>>
} = {
  game: profileDefinition(
    entryRules.game,
    v.never(),
    metadataMatchingSchemas.game,
    objectSchema(v.pick(relationRules, metadataRelationKeys.game).entries),
  ),
  anime: profileDefinition(
    entryRules.anime,
    partRules.anime,
    metadataMatchingSchemas.anime,
    objectSchema(v.pick(relationRules, metadataRelationKeys.anime).entries),
  ),
  comic: profileDefinition(
    entryRules.comic,
    partRules.comic,
    metadataMatchingSchemas.comic,
    objectSchema(v.pick(relationRules, metadataRelationKeys.comic).entries),
  ),
  novel: profileDefinition(
    entryRules.novel,
    partRules.novel,
    metadataMatchingSchemas.novel,
    objectSchema(v.pick(relationRules, metadataRelationKeys.novel).entries),
  ),
  character: profileDefinition(
    entryRules.character,
    v.never(),
    metadataMatchingSchemas.character,
    objectSchema(v.pick(relationRules, metadataRelationKeys.character).entries),
  ),
  person: profileDefinition(
    entryRules.person,
    v.never(),
    metadataMatchingSchemas.person,
    objectSchema(v.pick(relationRules, metadataRelationKeys.person).entries),
  ),
  organization: profileDefinition(
    entryRules.organization,
    v.never(),
    metadataMatchingSchemas.organization,
    objectSchema(v.pick(relationRules, metadataRelationKeys.organization).entries),
  ),
}

/** Validate a whole executable definition, including every selected source reference and actual requested capability. */
export function parseMetadataProfileDefinition<Type extends EntryType>(
  type: Type,
  input: unknown,
): MetadataProfileDefinition<Type> {
  const definition = parseContract(profileSchemas[type], input, 'metadata profile definition')
  const selected = new Set(definition.providers)
  let ruleCount = 0
  function visit(value: unknown): void {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return
    }
    const record: Record<string, unknown> = Object.fromEntries(Object.entries(value))
    if (Array.isArray(record.providers)) {
      ruleCount += 1
      if (
        record.providers.some(
          (provider: unknown) => typeof provider !== 'string' || !selected.has(provider),
        )
      ) {
        invalidInput('A profile rule refers to an unselected provider.')
      }
    }
    for (const nested of Object.values(record)) {
      visit(nested)
    }
  }
  visit(definition.fields)
  visit(definition.relations)
  if (ruleCount === 0) {
    invalidInput('A metadata profile must request at least one field or relationship.')
  }
  return definition
}
