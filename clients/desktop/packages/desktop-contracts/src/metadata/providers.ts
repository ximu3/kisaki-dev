/** @fileoverview Defines explicitly selected metadata providers, their pure capabilities and independently releasable read sessions. */

import * as v from 'valibot'
import { normalizeLocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import { DesktopError } from '../errors'
import type { CallOptions, NonEmptyArray, ExecutionContext, Registration } from '../operations'
import { nonemptyText, parseExternalValue, parseValue, text, unique } from '../validation'
import { entryTypes, identitySchema, languageSchema } from '../library/catalog'
import type { EntryType, ExternalIdentity } from '../library/catalog'
import {
  getMetadataEntryFields,
  getMetadataPartFields,
  parseIdentificationClues,
  parseImageCandidate,
  parseSourceEntry,
} from './fields'
import type {
  IdentificationClues,
  ImageCandidate,
  MetadataEntryField,
  MetadataImageField,
  MetadataPartField,
  SourceEntry,
} from './fields'
import {
  getMetadataRelations,
  metadataRelationFields,
  parseMetadataRelationScope,
} from './relations'
import type {
  MetadataRelationAttributeValues,
  MetadataRelationKey,
  MetadataRelationScopeValues,
  MetadataSessionRelationScopes,
  ScopedMetadataRelationKey,
} from './relations'
import { metadataPartKinds } from './values'
import type {
  MetadataPartKey,
  MetadataPartType,
  MetadataReadRequest,
  MetadataReadResult,
} from './values'

/** Search cursors are opaque and belong only to this provider/type/query/language tuple; an empty page is not the end. */
export interface MetadataSearchInput<T extends EntryType = EntryType> {
  readonly entryType: T
  readonly query: string
  readonly cursor?: string
  readonly preferredLanguages?: readonly string[]
}

export interface MetadataSearchResult<T extends EntryType = EntryType> {
  readonly records: readonly SourceEntry<T>[]
  readonly nextCursor?: string
}

export type MetadataResolveInput<T extends EntryType = EntryType> = {
  [K in T]: {
    readonly entryType: K
    readonly clues: IdentificationClues<K>
    readonly preferredLanguages?: readonly string[]
  }
}[T]

/** candidates is the complete usable candidate range for this resolve, not one truncated search page. */
export type ResolveResult<T extends EntryType = EntryType> =
  | { readonly type: 'resolved'; readonly record: SourceEntry<T> }
  | { readonly type: 'candidates'; readonly records: readonly SourceEntry<T>[] }
  | { readonly type: 'notFound' }
  | { readonly type: 'insufficientInput' }

export interface MetadataOpenSessionInput<T extends EntryType = EntryType> {
  readonly entryType: T
  readonly identity?: ExternalIdentity
  readonly preferredLanguages?: readonly string[]
}

/** Only ordinary explicit source lookup text is accepted; the provider documents its name, resource-coordinate or link syntax. */
export type MetadataImageSearchInput<T extends EntryType = EntryType> = {
  [K in T]: {
    readonly entryType: K
    readonly field: MetadataImageField<K>
    readonly query: string
    readonly cursor?: string
    readonly preferredLanguages?: readonly string[]
  }
}[T]

export interface MetadataImageSearchResult {
  readonly images: readonly ImageCandidate[]
  readonly nextCursor?: string
}

/** Field capability may be independent of root enumeration; missing identitySources limits related reads to real context. */
export interface MetadataObjectCapability<Field extends string> {
  readonly fields: readonly Field[]
  readonly identitySources?: NonEmptyArray<string>
}

export type MetadataReadCapabilities<T extends EntryType> = {
  readonly objects?: {
    readonly entry?: {
      readonly fields: readonly MetadataEntryField<T>[]
      readonly identitySources: NonEmptyArray<string>
    }
    readonly relatedEntries?: {
      readonly [K in EntryType]?: MetadataObjectCapability<MetadataEntryField<K>>
    }
    readonly parts?: {
      readonly [K in MetadataPartKey<T>]?: MetadataObjectCapability<
        MetadataPartField<MetadataPartType<T, K>>
      >
    }
    readonly tags?: { readonly fields: readonly ('description' | 'isNsfw')[] }
  }
  readonly relations?: {
    readonly [K in MetadataRelationKey<T>]?: {
      readonly fields: readonly Extract<keyof MetadataRelationAttributeValues[K], string>[]
    } & (K extends 'workCharacters' | 'personWorks' | 'organizationWorks' | 'workRelations'
      ? { readonly scope: MetadataRelationScopeValues[K] | null | 'session' }
      : object)
  }
}

/** Image lookup support is explicit per use; queryDescription explains source-specific accepted coordinates instead of guessing. */
export type MetadataProviderCapabilities<T extends EntryType = EntryType> = {
  readonly [K in T]?: {
    readonly search?: true
    readonly resolve?: true
    readonly read?: MetadataReadCapabilities<K>
    readonly images?: {
      readonly [F in MetadataImageField<K>]?: { readonly queryDescription: LocalizedText }
    }
  }
}

/**
 * One source context fixes language and relation scopes before reads. Reads can overlap; close rejects new reads,
 * waits accepted reads and releases resources. Close is idempotent and does not reuse a cancelled read signal.
 */
export interface MetadataReadSession<T extends EntryType = EntryType> {
  readonly relationScopes: MetadataSessionRelationScopes<T>

  read(request: MetadataReadRequest<T>, context: ExecutionContext): Promise<MetadataReadResult<T>>

  close(): Promise<void>
}

/** Providers return original source facts and own their account/cache policy; they never decide local catalog adoption. */
export interface MetadataProvider<T extends EntryType = EntryType> {
  readonly name: LocalizedText
  readonly description?: LocalizedText
  readonly capabilities: MetadataProviderCapabilities<T>

  search?(
    input: MetadataSearchInput<T>,
    context: ExecutionContext,
  ): Promise<MetadataSearchResult<T>>
  resolve?(input: MetadataResolveInput<T>, context: ExecutionContext): Promise<ResolveResult<T>>

  openSession?(
    input: MetadataOpenSessionInput<T>,
    context: ExecutionContext,
  ): Promise<MetadataReadSession<T>>

  searchImages?(
    input: MetadataImageSearchInput<T>,
    context: ExecutionContext,
  ): Promise<MetadataImageSearchResult>
}

export interface MetadataProviderDescriptor {
  readonly id: string
  readonly name: LocalizedText
  readonly description?: LocalizedText
  readonly capabilities: MetadataProviderCapabilities
}

/** The desktop registers complete IDs. The SDK prefixes the actual extension owner to its instance-local id. */
export interface MetadataProvidersApi {
  list(call?: CallOptions): Promise<readonly MetadataProviderDescriptor[]>
  get(providerId: string, call?: CallOptions): Promise<MetadataProviderDescriptor | null>

  register(
    providerId: string,
    provider: MetadataProvider,
    call?: CallOptions,
  ): Promise<Registration<string>>
}

const languages = v.pipe(
  v.array(languageSchema),
  v.transform((values) => [...new Set(values)]),
)

const paging = { cursor: v.exactOptional(text), preferredLanguages: v.exactOptional(languages) }

function fieldNames(names: readonly string[]) {
  return v.pipe(
    v.array(v.picklist(names)),
    v.check((values) => unique(values, (value) => value)),
  )
}

const sources = v.pipe(
  v.tupleWithRest([identitySchema.entries.source], identitySchema.entries.source),
  v.check((values) => unique(values, (value) => value)),
)

function nodeCapability(fields: readonly string[], root: boolean) {
  return v.strictObject({
    fields: fieldNames(fields),
    identitySources: root ? sources : v.exactOptional(sources),
  })
}

/** Parse all declared contexts and scopes without activating code or treating declaration as proof of account availability. */
export function parseMetadataProviderCapabilities(
  input: unknown,
  defaultLocale: string,
): MetadataProviderCapabilities {
  const entries = Object.fromEntries(
    entryTypes.map((root) => {
      const related = Object.fromEntries(
        entryTypes.map((type) => [
          type,
          v.exactOptional(nodeCapability(getMetadataEntryFields(type), false)),
        ]),
      )

      const parts = Object.fromEntries(
        Object.entries(metadataPartKinds[root]).map(([slot, type]) => [
          slot,
          v.exactOptional(nodeCapability(getMetadataPartFields(type), false)),
        ]),
      )

      const relations = Object.fromEntries(
        getMetadataRelations(root).map((relation) => {
          const scoped = [
            'workCharacters',
            'personWorks',
            'organizationWorks',
            'workRelations',
          ].includes(relation)
          const scope = v.pipe(
            v.unknown(),
            v.transform((value) =>
              value === null || value === 'session'
                ? value
                : parseMetadataRelationScope(root, relation as ScopedMetadataRelationKey, value),
            ),
          )
          const capability = scoped
            ? v.strictObject({ fields: fieldNames(metadataRelationFields[relation]), scope })
            : v.strictObject({ fields: fieldNames(metadataRelationFields[relation]) })
          return [relation, v.exactOptional(capability)]
        }),
      )

      const read = v.strictObject({
        objects: v.exactOptional(
          v.strictObject({
            entry: v.exactOptional(nodeCapability(getMetadataEntryFields(root), true)),
            relatedEntries: v.exactOptional(v.strictObject(related)),
            parts: v.exactOptional(Object.keys(parts).length ? v.strictObject(parts) : v.never()),
            tags: v.exactOptional(
              v.strictObject({ fields: fieldNames(['description', 'isNsfw']) }),
            ),
          }),
        ),
        relations: v.exactOptional(v.strictObject(relations)),
      })

      const imageFields = getMetadataEntryFields(root).filter((field) =>
        ['primaryImage', 'backdropImage', 'titleLogo', 'iconImage'].includes(field),
      )
      const images = Object.fromEntries(
        imageFields.map((field) => [
          field,
          v.exactOptional(
            v.strictObject({
              queryDescription: v.pipe(
                v.unknown(),
                v.transform((value) =>
                  parseExternalValue(
                    (input) => normalizeLocalizedText(input, defaultLocale),
                    value,
                    'Invalid image lookup description',
                  ),
                ),
              ),
            }),
          ),
        ]),
      )

      return [
        root,
        v.exactOptional(
          v.strictObject({
            search: v.exactOptional(v.literal(true)),
            resolve: v.exactOptional(v.literal(true)),
            read: v.exactOptional(read),
            images: v.exactOptional(v.strictObject(images)),
          }),
        ),
      ]
    }),
  )
  return parseValue(
    v.strictObject(entries),
    input,
    'Invalid metadata provider capabilities',
  ) as MetadataProviderCapabilities
}

/** Check promised methods before publishing a registration. Real arguments and results are parsed at each later call boundary. */
export function validateMetadataProvider(provider: MetadataProvider, defaultLocale: string): void {
  parseExternalValue(
    (value) => normalizeLocalizedText(value, defaultLocale),
    provider.name,
    'Invalid metadata provider name',
  )
  if (provider.description !== undefined) {
    parseExternalValue(
      (value) => normalizeLocalizedText(value, defaultLocale),
      provider.description,
      'Invalid metadata provider description',
    )
  }

  const capabilities = parseMetadataProviderCapabilities(provider.capabilities, defaultLocale)
  for (const capability of Object.values(capabilities)) {
    if (!capability) {
      continue
    }
    if (
      (capability.search && typeof provider.search !== 'function') ||
      (capability.resolve && typeof provider.resolve !== 'function') ||
      (capability.read && typeof provider.openSession !== 'function') ||
      (capability.images &&
        Object.keys(capability.images).length > 0 &&
        typeof provider.searchImages !== 'function')
    ) {
      throw new DesktopError(
        'InvalidInput',
        'Metadata provider declared an operation without an implementation',
      )
    }
  }
}

/** Preserve cursor presence, including a source-defined empty token, independently of search text. */
export function parseMetadataSearchInput(input: unknown): MetadataSearchInput {
  return parseValue(
    v.strictObject({ entryType: v.picklist(entryTypes), query: text, ...paging }),
    input,
    'Invalid metadata search',
  )
}

/** Validate source location clues without accepting a local ID, page URL or caller-owned provider settings. */
export function parseMetadataResolveInput(input: unknown): MetadataResolveInput {
  const { entryType } = parseValue(v.looseObject({ entryType: v.picklist(entryTypes) }), input)
  return parseValue(
    v.strictObject({
      entryType: v.literal(entryType),
      clues: v.pipe(
        v.unknown(),
        v.transform((value) => parseIdentificationClues(entryType, value)),
      ),
      preferredLanguages: v.exactOptional(languages),
    }),
    input,
    'Invalid metadata resolve input',
  ) as MetadataResolveInput
}

/** An absent root identity is valid for explicit related/part field refs; it does not grant a fabricated root context. */
export function parseMetadataOpenSessionInput(input: unknown): MetadataOpenSessionInput {
  return parseValue(
    v.strictObject({
      entryType: v.picklist(entryTypes),
      identity: v.exactOptional(identitySchema),
      preferredLanguages: v.exactOptional(languages),
    }),
    input,
    'Invalid metadata read session input',
  )
}

/** Only actual per-type image uses are accepted; Part lookup and arbitrary field search are separate and unsupported. */
export function parseMetadataImageSearchInput(input: unknown): MetadataImageSearchInput {
  const { entryType } = parseValue(v.looseObject({ entryType: v.picklist(entryTypes) }), input)
  const images = getMetadataEntryFields(entryType).filter((field) =>
    ['primaryImage', 'backdropImage', 'titleLogo', 'iconImage'].includes(field),
  )
  return parseValue(
    v.strictObject({
      entryType: v.literal(entryType),
      field: v.picklist(images),
      query: nonemptyText,
      ...paging,
    }),
    input,
    'Invalid image lookup',
  ) as MetadataImageSearchInput
}

/** Returned source roots must match the requested entry type; search pagination remains independent of a full resolve result. */
export function parseMetadataSearchResult<T extends EntryType>(
  root: T,
  input: unknown,
): MetadataSearchResult<T> {
  const value = parseValue(
    v.strictObject({
      records: v.array(v.pipe(v.unknown(), v.transform(parseSourceEntry))),
      nextCursor: v.exactOptional(text),
    }),
    input,
    'Invalid metadata search result',
  )
  const records = value.records.filter((record): record is SourceEntry<T> => record.type === root)
  if (records.length !== value.records.length) {
    throw new DesktopError('InvalidInput', 'Source search returned an incompatible entry type')
  }

  return { ...value, records }
}

/** Resolve has four ordinary outcomes and no page cursor, inferred confidence score or completeness flag. */
export function parseResolveResult<T extends EntryType>(root: T, input: unknown): ResolveResult<T> {
  const entry = v.pipe(v.unknown(), v.transform(parseSourceEntry))
  const value = parseValue(
    v.variant('type', [
      v.strictObject({ type: v.literal('resolved'), record: entry }),
      v.strictObject({ type: v.literal('candidates'), records: v.array(entry) }),
      v.strictObject({ type: v.literal('notFound') }),
      v.strictObject({ type: v.literal('insufficientInput') }),
    ]),
    input,
    'Invalid resolve result',
  )

  let records: readonly SourceEntry[] = []
  if (value.type === 'resolved') {
    records = [value.record]
  } else if (value.type === 'candidates') {
    records = value.records
  }
  if (records.some((record) => record.type !== root)) {
    throw new DesktopError('InvalidInput', 'Resolve returned an incompatible root type')
  }

  return value as ResolveResult<T>
}

/** Image pages retain original/preview policies and do not claim a local total or completed archive of the remote source. */
export function parseMetadataImageSearchResult(input: unknown): MetadataImageSearchResult {
  return parseValue(
    v.strictObject({
      images: v.array(v.pipe(v.unknown(), v.transform(parseImageCandidate))),
      nextCursor: v.exactOptional(text),
    }),
    input,
    'Invalid metadata image result',
  )
}
