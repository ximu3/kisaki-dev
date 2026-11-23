import type { NonEmptyArray, StoredDefinition, CallOptions, Disposable } from '../operations'
import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { ReorderInput } from '../library/ordering'
import * as v from 'valibot'
import {
  fromParser,
  id,
  unique,
  parseValue,
  nonemptyText,
  text,
  optionalFields,
  validateExpectedKeys,
} from '../validation'
import { entryTypes, languageSchema, type EntryType } from '../library/catalog'
import {
  getMetadataEntryFields,
  getMetadataPartFields,
  type MetadataEntryFieldValues,
  type MetadataPartFieldValues,
} from './fields'
import { metadataPartKinds, type MetadataPartKey, type MetadataPartType } from './objects'
import {
  getMetadataRelations,
  metadataRelationFields,
  type MetadataRelationAttributeValues,
  type MetadataRelationKey,
} from './relations'
import { parseMetadataMatchingRules, type MetadataMatchingRules } from './matching'
import { DesktopError } from '../errors'

/**
 * Union applies only to collections. Processors transform the selected value after object
 * correspondence is fixed.
 */
export interface MetadataFieldRule<Value> {
  readonly providers: NonEmptyArray<string>
  readonly selection: Value extends readonly unknown[]
    ? 'first' | 'firstNonEmpty' | 'union'
    : 'first' | 'firstNonEmpty'
  readonly processors?: readonly string[]
}

export type MetadataEntryFieldRules<T extends EntryType> = {
  readonly [F in keyof MetadataEntryFieldValues[T]]?: MetadataFieldRule<
    MetadataEntryFieldValues[T][F]
  >
}

export type MetadataPartFieldRules<T extends EntryType> = {
  readonly [K in MetadataPartKey<T>]?: {
    readonly [F in keyof MetadataPartFieldValues[MetadataPartType<T, K>]]?: MetadataFieldRule<
      MetadataPartFieldValues[MetadataPartType<T, K>][F]
    >
  }
}

/** Attribute providers enrich selected members. Membership is selected separately. */
export interface MetadataRelationRule<K extends keyof MetadataRelationAttributeValues> {
  readonly providers: NonEmptyArray<string>
  readonly selection: 'first' | 'firstNonEmpty' | 'union'
  readonly fields?: {
    readonly [F in keyof MetadataRelationAttributeValues[K]]?: MetadataFieldRule<
      MetadataRelationAttributeValues[K][F]
    >
  }
}

/** A saved definition requires at least one requestable field or membership capability. */
export interface MetadataProfileDefinition<T extends EntryType = EntryType> {
  readonly providers: readonly string[]

  readonly matching: MetadataMatchingRules<T>

  readonly fields: {
    readonly entry?: MetadataEntryFieldRules<T>
    readonly relatedEntries?: { readonly [K in EntryType]?: MetadataEntryFieldRules<K> }
    readonly parts?: MetadataPartFieldRules<T>
    readonly tags?: {
      readonly description?: MetadataFieldRule<string | null>
      readonly isNsfw?: MetadataFieldRule<boolean>
    }
  }

  readonly relations: { readonly [K in MetadataRelationKey<T>]?: MetadataRelationRule<K> }
}

/** Later profile edits keep the snapshot for each accepted operation intact. */
export type MetadataProfileSnapshot<T extends EntryType = EntryType> = {
  [K in EntryType]: {
    readonly id: string
    readonly name: string
    readonly entryType: K
    readonly preferredLanguages: readonly string[]
    readonly definition: MetadataProfileDefinition<K>
  }
}[T]

export type MetadataProfile<T extends EntryType = EntryType> = {
  [K in EntryType]: {
    readonly id: string
    readonly name: string
    readonly description: string | null
    readonly entryType: K

    readonly preferredLanguages: readonly string[]
    readonly definition: StoredDefinition<MetadataProfileDefinition<K>>

    readonly isDefault: boolean
    readonly sortOrder: number

    /** UTC milliseconds since the Unix epoch. */
    readonly createdAt: number
    /** UTC milliseconds since the Unix epoch. */
    readonly updatedAt: number
  }
}[T]

export type MetadataProfileCreate = {
  [K in EntryType]: {
    readonly name: string
    readonly entryType: K
    readonly description?: string | null

    readonly preferredLanguages?: readonly string[]
    readonly definition: MetadataProfileDefinition<K>

    readonly isDefault?: boolean
    readonly expected?: { readonly defaultProfileId: string | null }
  }
}[EntryType]

export interface MetadataProfileEditableFields<T extends EntryType> {
  readonly name: string
  readonly description: string | null
  readonly preferredLanguages: readonly string[]
  readonly definition: MetadataProfileDefinition<T>
  readonly isDefault: boolean
}

export type MetadataProfileUpdate<T extends EntryType = EntryType> = {
  [K in EntryType]: {
    readonly changes: Partial<MetadataProfileEditableFields<K>>
    readonly expected?: Partial<MetadataProfileEditableFields<K>> & {
      readonly defaultProfileId?: string | null
    }
  }
}[T]

/**
 * Applicable languages filter presets. preferredLanguages determines execution order and is copied
 * into the draft.
 */
export type MetadataProfilePreset<T extends EntryType = EntryType> = {
  [K in EntryType]: {
    readonly id: string
    readonly defaultLocale: string
    readonly name: LocalizedText
    readonly description: LocalizedText
    readonly applicableLanguages: NonEmptyArray<string> | null

    readonly entryType: K
    readonly preferredLanguages: readonly string[]
    readonly definition: MetadataProfileDefinition<K>
  }
}[T]

/** Copying a preset uses the ordinary create path. Default selection is explicit. */
export interface MetadataProfilesApi {
  /** Reads saved profile summaries in formal order, optionally restricted to one entry kind. */
  list<T extends EntryType>(
    filter: { readonly entryType: T },
    call?: CallOptions,
  ): Promise<
    readonly Pick<
      MetadataProfile<T>,
      'id' | 'name' | 'description' | 'entryType' | 'preferredLanguages' | 'isDefault'
    >[]
  >
  list(
    filter?: { readonly entryType?: EntryType },
    call?: CallOptions,
  ): Promise<
    readonly Pick<
      MetadataProfile,
      'id' | 'name' | 'description' | 'entryType' | 'preferredLanguages' | 'isDefault'
    >[]
  >

  /**
   * Unavailable participants and invalid definitions remain explicit. Null means the profile is
   * absent.
   */
  get(id: string, call?: CallOptions): Promise<MetadataProfile | null>

  create<I extends MetadataProfileCreate>(
    input: I,
    call?: CallOptions,
  ): Promise<MetadataProfile<I['entryType']>>

  /** Compares the definition as a whole. Accepted fetches retain their captured snapshots. */
  update(id: string, input: MetadataProfileUpdate, call?: CallOptions): Promise<MetadataProfile>

  /** Live saved references prevent deletion and remain available for the caller to resolve. */
  delete(id: string, call?: CallOptions): Promise<void>

  /** Reorders selected profiles against the complete order for their entry kind. */
  reorder(entryType: EntryType, input: ReorderInput, call?: CallOptions): Promise<void>

  /**
   * Reads fixed definitions matching the requested entry kind and applicable language for use in
   * drafts.
   */
  listPresets<T extends EntryType>(
    filter: { readonly entryType: T; readonly language?: string },
    call?: CallOptions,
  ): Promise<readonly MetadataProfilePreset<T>[]>
  listPresets(
    filter?: { readonly entryType?: EntryType; readonly language?: string },
    call?: CallOptions,
  ): Promise<readonly MetadataProfilePreset[]>

  /**
   * Subscribe before reading. Invalidation refreshes saved data while drafts remain with their
   * owners.
   */
  onInvalidated(listener: () => void): Disposable
}

const providerIds = v.pipe(
  v.tupleWithRest([id], id),
  v.check((ids) => unique(ids, (value) => value)),
)

const collectionFields = new Set([
  'aliases',
  'externalLinks',
  'originalLanguages',
  'primaryImage',
  'backdropImage',
  'titleLogo',
  'iconImage',
])

function fieldRule(name: string) {
  return v.strictObject({
    providers: providerIds,
    selection: collectionFields.has(name)
      ? v.picklist(['first', 'firstNonEmpty', 'union'])
      : v.picklist(['first', 'firstNonEmpty']),
    processors: v.exactOptional(v.array(id)),
  })
}

function fields(names: readonly string[]) {
  return v.strictObject(
    Object.fromEntries(names.map((name) => [name, v.exactOptional(fieldRule(name))])),
  )
}

/** Saved definitions can retain references to currently unavailable implementations. */
export function parseMetadataProfileDefinition<T extends EntryType>(
  root: T,
  input: unknown,
): MetadataProfileDefinition<T>

export function parseMetadataProfileDefinition(
  root: EntryType,
  input: unknown,
): MetadataProfileDefinition {
  const related = Object.fromEntries(
    entryTypes.map((type) => [type, v.exactOptional(fields(getMetadataEntryFields(type)))]),
  )

  const parts = Object.fromEntries(
    Object.entries(metadataPartKinds[root]).map(([slot, type]) => [
      slot,
      v.exactOptional(fields(getMetadataPartFields(type))),
    ]),
  )

  const relationRules = Object.fromEntries(
    getMetadataRelations(root).map((relation) => [
      relation,
      v.exactOptional(
        v.strictObject({
          providers: providerIds,
          selection: v.picklist(['first', 'firstNonEmpty', 'union']),
          fields: v.exactOptional(
            metadataRelationFields[relation].length > 0
              ? fields(metadataRelationFields[relation])
              : v.never(),
          ),
        }),
      ),
    ]),
  )
  const value = parseValue(
    v.strictObject({
      providers: v.pipe(
        v.array(id),
        v.check((ids) => unique(ids, (value) => value)),
      ),
      matching: fromParser((value) => parseMetadataMatchingRules(root, value)),
      fields: v.strictObject({
        entry: v.exactOptional(fields(getMetadataEntryFields(root))),
        relatedEntries: v.exactOptional(v.strictObject(related)),
        parts: v.exactOptional(Object.keys(parts).length > 0 ? v.strictObject(parts) : v.never()),
        tags: v.exactOptional(fields(['description', 'isNsfw'])),
      }),
      relations: v.strictObject(relationRules),
    }),
    input,
    'Invalid metadata profile definition',
  )

  const selected = new Set(value.providers)
  let capabilities = 0

  function checkFields(input: object | undefined): void {
    for (const rule of Object.values(input ?? {}) as { providers: readonly string[] }[]) {
      if (rule.providers.some((provider) => !selected.has(provider))) {
        throw new DesktopError(
          'InvalidInput',
          'A field rule references a provider outside the profile',
        )
      }
      capabilities += 1
    }
  }

  checkFields(value.fields.entry)
  checkFields(value.fields.tags)
  for (const node of Object.values(value.fields.relatedEntries ?? {})) {
    checkFields(node)
  }

  for (const node of Object.values(value.fields.parts ?? {})) {
    checkFields(node)
  }

  for (const rule of Object.values(value.relations)) {
    if (!rule) {
      continue
    }
    if (rule.providers.some((provider) => !selected.has(provider))) {
      throw new DesktopError(
        'InvalidInput',
        'A relation rule references a provider outside the profile',
      )
    }
    capabilities += 1
    checkFields(rule.fields)
  }

  if (capabilities === 0) {
    throw new DesktopError(
      'InvalidInput',
      'A saved metadata profile must provide a requestable field or relation',
    )
  }

  return value as MetadataProfileDefinition
}

/** Canonical preferred languages deduplicated in their first supplied order. */
const languages = v.pipe(
  v.array(languageSchema),
  v.transform((values) => [...new Set(values)]),
)

/** A default baseline is allowed only when explicitly selecting the new profile as default. */
export function parseMetadataProfileCreate(input: unknown): MetadataProfileCreate {
  const { entryType } = parseValue(v.looseObject({ entryType: v.picklist(entryTypes) }), input)
  const value = parseValue(
    v.strictObject({
      entryType: v.literal(entryType),
      name: nonemptyText,
      description: v.exactOptional(v.nullable(text)),
      preferredLanguages: v.exactOptional(languages),
      definition: fromParser((value) => parseMetadataProfileDefinition(entryType, value)),
      isDefault: v.exactOptional(v.boolean()),
      expected: v.exactOptional(v.strictObject({ defaultProfileId: v.nullable(id) })),
    }),
    input,
    'Invalid metadata profile creation',
  )
  if (value.expected && value.isDefault !== true) {
    throw new DesktopError('InvalidInput', 'Default profile baseline requires isDefault: true')
  }

  return value as MetadataProfileCreate
}

/**
 * The definition is compared as one value. The defaultProfileId baseline requires explicitly
 * selecting this profile as default.
 */
export function parseMetadataProfileUpdate<T extends EntryType>(
  entryType: T,
  input: unknown,
): MetadataProfileUpdate<T> {
  const entries = {
    name: nonemptyText,
    description: v.nullable(text),
    preferredLanguages: languages,
    definition: fromParser((value) => parseMetadataProfileDefinition(entryType, value)),
    isDefault: v.boolean(),
  }
  const value = parseValue(
    v.strictObject({
      changes: v.strictObject(optionalFields(entries)),
      expected: v.exactOptional(
        v.strictObject(optionalFields({ ...entries, defaultProfileId: v.nullable(id) })),
      ),
    }),
    input,
    'Invalid metadata profile edit',
  )
  validateExpectedKeys(value.changes, value.expected, ['defaultProfileId'])
  if (
    value.expected &&
    Object.hasOwn(value.expected, 'defaultProfileId') &&
    value.changes.isDefault !== true
  ) {
    throw new DesktopError(
      'InvalidInput',
      'Default profile baseline requires selecting this profile',
    )
  }

  return value as MetadataProfileUpdate<T>
}
