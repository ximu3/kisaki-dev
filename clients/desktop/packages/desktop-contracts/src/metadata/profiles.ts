/** @fileoverview Defines reusable metadata profiles with explicit provider order, matching and per-field selection rules. */

import type { NonEmptyArray, StoredDefinition, CallOptions, Disposable } from '../operations'
import type { EntryType } from '../library/catalog'
import type { MetadataEntryFieldValues, MetadataPartFieldValues } from './fields'
import type { MetadataPartKey, MetadataPartType } from './objects'
import type { MetadataRelationAttributeValues, MetadataRelationKey } from './relations'
import type { MetadataMatchingRules } from './matching'
import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { ReorderInput } from '../library/ordering'
import * as v from 'valibot'
import {
  id,
  unique,
  parseValue,
  nonemptyText,
  text,
  optionalFields,
  validateExpectedKeys,
} from '../validation'
import { entryTypes, languageSchema } from '../library/catalog'
import { getMetadataEntryFields, getMetadataPartFields } from './fields'
import { metadataPartKinds } from './objects'
import { getMetadataRelations, metadataRelationFields } from './relations'
import { parseMetadataMatchingRules } from './matching'
import { DesktopError } from '../errors'

/**
 * Ordered provider selection and optional processing pipeline for one field.
 *
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

/** Optional selection and processing rules for fields of one entry kind. */
export type MetadataEntryFieldRules<T extends EntryType> = {
  readonly [F in keyof MetadataEntryFieldValues[T]]?: MetadataFieldRule<
    MetadataEntryFieldValues[T][F]
  >
}

/** Optional field rules grouped by the root kind's supported part slots. */
export type MetadataPartFieldRules<T extends EntryType> = {
  readonly [K in MetadataPartKey<T>]?: {
    readonly [F in keyof MetadataPartFieldValues[MetadataPartType<T, K>]]?: MetadataFieldRule<
      MetadataPartFieldValues[MetadataPartType<T, K>][F]
    >
  }
}

/**
 * Provider rules for relation membership and its non-identity attributes.
 *
 * Attribute providers enrich selected members and cannot add members.
 */
export interface MetadataRelationRule<K extends keyof MetadataRelationAttributeValues> {
  readonly providers: NonEmptyArray<string>
  readonly selection: 'first' | 'firstNonEmpty' | 'union'
  readonly fields?: {
    readonly [F in keyof MetadataRelationAttributeValues[K]]?: MetadataFieldRule<
      MetadataRelationAttributeValues[K][F]
    >
  }
}

/**
 * Explicit provider order, matching rules, field rules and relation rules for a metadata profile.
 *
 * A saved definition must provide at least one requestable field or membership capability.
 */
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

/**
 * Valid profile definition and language order captured before asynchronous execution.
 *
 * Later profile edits leave accepted operations' snapshots unchanged.
 */
export type MetadataProfileSnapshot<T extends EntryType = EntryType> = {
  [K in EntryType]: {
    readonly id: string
    readonly name: string
    readonly entryType: K
    readonly preferredLanguages: readonly string[]
    readonly definition: MetadataProfileDefinition<K>
  }
}[T]

/**
 * Saved profile with display metadata, explicit definition validity, default status and ordering.
 */
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

/**
 * Input for an independent profile with a fixed entry kind and optional default-selection baseline.
 */
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

/** Independently editable profile values, with the full definition treated as one value. */
export interface MetadataProfileEditableFields<T extends EntryType> {
  readonly name: string
  readonly description: string | null
  readonly preferredLanguages: readonly string[]
  readonly definition: MetadataProfileDefinition<T>
  readonly isDefault: boolean
}

/** Profile edits with optional original field values and a contextual default-profile baseline. */
export type MetadataProfileUpdate<T extends EntryType = EntryType> = {
  [K in EntryType]: {
    readonly changes: Partial<MetadataProfileEditableFields<K>>
    readonly expected?: Partial<MetadataProfileEditableFields<K>> & {
      readonly defaultProfileId?: string | null
    }
  }
}[T]

/**
 * Localized starting definition for an independent user profile.
 *
 * Applicable languages filter the preset catalog; preferredLanguages is the actual execution order
 * copied into the draft.
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

/**
 * Saved profile management, preset discovery and directory invalidation.
 *
 * Copying creates an independent profile through the ordinary create operation and leaves default
 * selection explicit.
 */
export interface MetadataProfilesApi {
  /** Reads saved profile summaries in formal order, optionally restricted to one entry kind. */
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
   * Reads a complete saved profile, returning null when absent.
   *
   * Unavailable participants and invalid definitions remain explicit.
   */
  get(id: string, call?: CallOptions): Promise<MetadataProfile | null>

  /** Commits an independent profile from the supplied definition and explicit default selection. */
  create(input: MetadataProfileCreate, call?: CallOptions): Promise<MetadataProfile>

  /**
   * Compares and commits changed fields and complete definition values.
   *
   * Already accepted fetches retain their captured profile snapshots.
   */
  update(id: string, input: MetadataProfileUpdate, call?: CallOptions): Promise<MetadataProfile>

  /**
   * Deletes a profile after rechecking formal references.
   *
   * Existing references prevent removal and remain available for the caller to resolve.
   */
  delete(id: string, call?: CallOptions): Promise<void>

  /** Reorders selected profiles against the complete order for their entry kind. */
  reorder(entryType: EntryType, input: ReorderInput, call?: CallOptions): Promise<void>

  /**
   * Reads fixed definitions matching the requested entry kind and applicable language for use in
   * drafts.
   */
  listPresets(
    filter?: { readonly entryType?: EntryType; readonly language?: string },
    call?: CallOptions,
  ): Promise<readonly MetadataProfilePreset[]>

  /**
   * Subscribes to saved-profile directory invalidation and returns the subscription lifetime.
   *
   * Callers subscribe before reading, then refresh saved data while preserving drafts.
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

/** Creates a field-rule schema permitting union only for collection-valued fields. */
function fieldRule(name: string) {
  return v.strictObject({
    providers: providerIds,
    selection: collectionFields.has(name)
      ? v.picklist(['first', 'firstNonEmpty', 'union'])
      : v.picklist(['first', 'firstNonEmpty']),
    processors: v.exactOptional(v.array(id)),
  })
}

/** Creates optional field-rule entries for a supplied metadata vocabulary. */
function fields(names: readonly string[]) {
  return v.strictObject(
    Object.fromEntries(names.map((name) => [name, v.exactOptional(fieldRule(name))])),
  )
}

/**
 * Parses a profile definition and checks rules against its selected providers.
 *
 * Validation permits currently unavailable implementations so saved definitions can retain their
 * references.
 */
export function parseMetadataProfileDefinition<T extends EntryType>(
  root: T,
  input: unknown,
): MetadataProfileDefinition<T>

/**
 * Builds root-specific rule schemas, checks provider membership and requires a requestable
 * capability.
 */
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
      matching: v.pipe(
        v.unknown(),
        v.transform((value) => parseMetadataMatchingRules(root, value)),
      ),
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

  /** Checks field-rule provider membership and counts each configured field capability. */
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

const languages = v.pipe(
  v.array(languageSchema),
  v.transform((values) => [...new Set(values)]),
)

/**
 * Parses creation fields and a definition for the selected entry kind.
 *
 * A default-profile baseline is accepted only when explicitly selecting the new profile as default.
 */
export function parseMetadataProfileCreate(input: unknown): MetadataProfileCreate {
  const { entryType } = parseValue(v.looseObject({ entryType: v.picklist(entryTypes) }), input)
  const value = parseValue(
    v.strictObject({
      entryType: v.literal(entryType),
      name: nonemptyText,
      description: v.exactOptional(v.nullable(text)),
      preferredLanguages: v.exactOptional(languages),
      definition: v.pipe(
        v.unknown(),
        v.transform((value) => parseMetadataProfileDefinition(entryType, value)),
      ),
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
 * Parses profile field edits and their baselines, treating definition as one complete value.
 *
 * The contextual defaultProfileId baseline requires explicitly selecting this profile as default.
 */
export function parseMetadataProfileUpdate<T extends EntryType>(
  entryType: T,
  input: unknown,
): MetadataProfileUpdate<T> {
  const entries = {
    name: nonemptyText,
    description: v.nullable(text),
    preferredLanguages: languages,
    definition: v.pipe(
      v.unknown(),
      v.transform((value) => parseMetadataProfileDefinition(entryType, value)),
    ),
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
