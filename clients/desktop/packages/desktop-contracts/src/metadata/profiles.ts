/** @fileoverview Defines reusable metadata profiles with explicit provider order, matching and per-field selection rules. */

import * as v from 'valibot'
import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import { DesktopError } from '../errors'
import type { CallOptions, Disposable, NonEmptyArray, StoredDefinition } from '../operations'
import {
  id,
  nonemptyText,
  optionalFields,
  parseValue,
  text,
  unique,
  validateExpectedKeys,
} from '../validation'
import { entryTypes, languageSchema } from '../library/catalog'
import type { EntryType } from '../library/catalog'
import type { ReorderInput } from '../library/ordering'
import { getMetadataEntryFields, getMetadataPartFields } from './fields'
import type { MetadataEntryFieldValues, MetadataPartFieldValues } from './fields'
import { parseMetadataMatchingRules } from './matching'
import { getMetadataRelations, metadataRelationFields } from './relations'
import type { MetadataRelationAttributeValues, MetadataRelationKey } from './relations'
import { metadataPartKinds } from './values'
import type { MetadataMatchingRules, MetadataPartKey, MetadataPartType } from './values'

/** Scalars have no union operation. Ordered processors transform only the selected field after correspondence is fixed. */
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
/** Member selection and non-identity attribute selection are independent; attribute providers cannot add members. */
export interface MetadataRelationRule<K extends keyof MetadataRelationAttributeValues> {
  readonly providers: NonEmptyArray<string>
  readonly selection: 'first' | 'firstNonEmpty' | 'union'
  readonly fields?: {
    readonly [F in keyof MetadataRelationAttributeValues[K]]?: MetadataFieldRule<
      MetadataRelationAttributeValues[K][F]
    >
  }
}
/** All four groups are explicit. At least one actual field or membership capability is required for a saved profile. */
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
/** Actual execution fixes a valid definition and language order before asynchronous work; later edits do not alter this snapshot. */
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
    readonly createdAt: number
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
/** Applicable language is a catalog filter, separate from actual preferredLanguages copied into an independent user profile. */
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
/** Deletion rechecks formal references. Copying uses a fresh ordinary create and does not copy default status. */
export interface MetadataProfilesApi {
  list(
    filter?: { readonly entryType?: EntryType },
    call?: CallOptions,
  ): Promise<
    readonly Pick<
      MetadataProfile,
      'id' | 'name' | 'description' | 'entryType' | 'preferredLanguages' | 'isDefault'
    >[]
  >
  get(id: string, call?: CallOptions): Promise<MetadataProfile | null>
  create(input: MetadataProfileCreate, call?: CallOptions): Promise<MetadataProfile>
  update(id: string, input: MetadataProfileUpdate, call?: CallOptions): Promise<MetadataProfile>
  delete(id: string, call?: CallOptions): Promise<void>
  reorder(entryType: EntryType, input: ReorderInput, call?: CallOptions): Promise<void>
  listPresets(
    filter?: { readonly entryType?: EntryType; readonly language?: string },
    call?: CallOptions,
  ): Promise<readonly MetadataProfilePreset[]>
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

/** Validate every selected rule and provider reference without requiring that the implementation is currently online. */
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
/** Entry type is fixed at creation, and a default precondition is accepted only when explicitly choosing this default. */
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
/** Changes are closed independent fields; definition is one whole value and defaultProfileId is the sole contextual precondition. */
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
