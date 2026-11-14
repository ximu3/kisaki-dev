/** @fileoverview Defines explicitly selected metadata providers, their pure capabilities and independently releasable read sessions. */

import type { EntryType, ExternalIdentity } from '../library/catalog'
import type {
  SourceEntry,
  IdentificationClues,
  MetadataImageField,
  ImageCandidate,
  MetadataEntryField,
  MetadataPartField,
} from './fields'
import type { NonEmptyArray, ExecutionContext, CallOptions, Registration } from '../operations'
import type { MetadataPartKey, MetadataPartType } from './objects'
import type {
  MetadataRelationKey,
  MetadataRelationAttributeValues,
  MetadataRelationScopeValues,
  MetadataSessionRelationScopes,
  ScopedMetadataRelationKey,
} from './relations'
import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { MetadataReadRequest } from './requests'
import type { MetadataReadResult } from './responses'
import * as v from 'valibot'
import { languageSchema, identitySchema, entryTypes } from '../library/catalog'
import { text, unique, parseExternalValue, parseValue, nonemptyText } from '../validation'
import {
  fieldNamesSchema,
  getMetadataEntryFields,
  getMetadataPartFields,
  parseIdentificationClues,
  parseSourceEntry,
  parseImageCandidate,
} from './fields'
import { metadataPartKinds } from './objects'
import {
  getMetadataRelations,
  parseMetadataRelationScope,
  metadataRelationFields,
} from './relations'
import { normalizeLocalizedText } from '@kisaki3/extension-distribution/metadata'
import { DesktopError } from '../errors'

/**
 * Provider search request with optional language order and an opaque continuation cursor.
 *
 * The cursor belongs to this provider, entry kind, query and language tuple.
 */
export interface MetadataSearchInput<T extends EntryType = EntryType> {
  readonly entryType: T
  readonly query: string
  readonly cursor?: string
  readonly preferredLanguages?: readonly string[]
}

/**
 * Page of source entries with an optional continuation cursor.
 *
 * Cursor absence marks completion; an empty page may still have a continuation.
 */
export interface MetadataSearchResult<T extends EntryType = EntryType> {
  readonly records: readonly SourceEntry<T>[]
  readonly nextCursor?: string
}

/** Source-root resolution request using kind-specific clues and optional language preferences. */
export type MetadataResolveInput<T extends EntryType = EntryType> = {
  [K in T]: {
    readonly entryType: K
    readonly clues: IdentificationClues<K>
    readonly preferredLanguages?: readonly string[]
  }
}[T]

/**
 * Source-root resolution outcome distinguishing one identity, candidates, no match and insufficient
 * input.
 *
 * A candidates result contains the complete usable candidate range for that resolve operation.
 */
export type MetadataResolveResult<T extends EntryType = EntryType> =
  | { readonly type: 'resolved'; readonly record: SourceEntry<T> }
  | { readonly type: 'candidates'; readonly records: readonly SourceEntry<T>[] }
  | { readonly type: 'notFound' }
  | { readonly type: 'insufficientInput' }

/**
 * Source-session context with an entry kind, optional root identity and language preferences.
 *
 * Omitting the root identity supports explicit related-entry or part references without fabricating
 * a root context.
 */
export interface MetadataOpenSessionInput<T extends EntryType = EntryType> {
  readonly entryType: T
  readonly identity?: ExternalIdentity
  readonly preferredLanguages?: readonly string[]
}

/**
 * Image lookup request for an entry kind and a supported image use.
 *
 * The provider describes its accepted name, resource-coordinate or link syntax.
 */
export type MetadataImageSearchInput<T extends EntryType = EntryType> = {
  [K in T]: {
    readonly entryType: K
    readonly field: MetadataImageField<K>
    readonly query: string
    readonly cursor?: string
    readonly preferredLanguages?: readonly string[]
  }
}[T]

/**
 * Page of unadopted image candidates with an optional continuation cursor.
 *
 * Cursor absence marks completion independently of whether the page is empty.
 */
export interface MetadataImageSearchResult {
  readonly images: readonly ImageCandidate[]
  readonly nextCursor?: string
}

/**
 * Readable fields and optional directly addressable identity namespaces for an object group.
 *
 * Without identitySources, related reads depend on the real source context.
 */
export interface MetadataObjectCapability<Field extends string> {
  readonly fields: readonly Field[]
  readonly identitySources?: NonEmptyArray<string>
}

/** Readable object fields, relation attributes and scope declarations for an entry root kind. */
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

/**
 * Search, resolution, reading and per-use image lookup capabilities declared for entry kinds.
 *
 * Each image lookup declares a localized description of its accepted source coordinates.
 */
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

/** Owned source context with fixed language and relation scopes shared by overlapping reads. */
export interface MetadataReadSession<T extends EntryType = EntryType> {
  readonly relationScopes: MetadataSessionRelationScopes<T>

  /**
   * Reads requested facts within the session's fixed context.
   *
   * Overlapping calls have independent cancellation.
   */
  read(request: MetadataReadRequest<T>, context: ExecutionContext): Promise<MetadataReadResult<T>>

  /**
   * Rejects new reads, waits for accepted reads and releases session resources.
   *
   * Close is idempotent and independent of cancelled read signals.
   */
  close(): Promise<void>
}

/**
 * Provider of original source facts with its own account and cache policy.
 *
 * The host owns local catalog adoption decisions.
 */
export interface MetadataProvider<T extends EntryType = EntryType> {
  readonly name: LocalizedText
  readonly description?: LocalizedText
  readonly capabilities: MetadataProviderCapabilities<T>

  /** Returns source candidates and original matching evidence for the requested entry kind. */
  search?(
    input: MetadataSearchInput<T>,
    context: ExecutionContext,
  ): Promise<MetadataSearchResult<T>>

  /**
   * Returns a resolved identity or complete candidate range, distinguishing no match from
   * insufficient input.
   */
  resolve?(
    input: MetadataResolveInput<T>,
    context: ExecutionContext,
  ): Promise<MetadataResolveResult<T>>

  /**
   * Captures source context and relation scopes in an owned read session.
   *
   * Failed setup releases resources acquired before the failure.
   */
  openSession?(
    input: MetadataOpenSessionInput<T>,
    context: ExecutionContext,
  ): Promise<MetadataReadSession<T>>

  /**
   * Returns candidates for the declared image use and supported source coordinates.
   *
   * The host owns subsequent image adoption.
   */
  searchImages?(
    input: MetadataImageSearchInput<T>,
    context: ExecutionContext,
  ): Promise<MetadataImageSearchResult>
}

/** Discoverable provider identity, localized description and declared capabilities. */
export interface MetadataProviderDescriptor {
  readonly id: string
  readonly name: LocalizedText
  readonly description?: LocalizedText
  readonly capabilities: MetadataProviderCapabilities
}

/**
 * Provider discovery and lifetime registration by complete identity.
 *
 * The SDK prefixes extension-local IDs with the actual extension owner.
 */
export interface MetadataProvidersApi {
  /** Reads registered provider descriptions and declared capabilities. */
  list(call?: CallOptions): Promise<readonly MetadataProviderDescriptor[]>

  /** Reads a current provider descriptor, returning null when its identity is unavailable. */
  get(providerId: string, call?: CallOptions): Promise<MetadataProviderDescriptor | null>

  /**
   * Registers an implementation for its actual owner and instance and returns its removal handle.
   *
   * Duplicate identities fail.
   */
  register(
    providerId: string,
    provider: MetadataProvider,
    call?: CallOptions,
  ): Promise<Registration<string>>
}

/** Canonical language preferences deduplicated while retaining caller priority. */
const languages = v.pipe(
  v.array(languageSchema),
  v.transform((values) => [...new Set(values)]),
)

/** Optional continuation cursor and preferred languages for source-page requests. */
const paging = { cursor: v.exactOptional(text), preferredLanguages: v.exactOptional(languages) }

/** Nonempty distinct source namespaces declared by a metadata provider. */
const sources = v.pipe(
  v.tupleWithRest([identitySchema.entries.source], identitySchema.entries.source),
  v.check((values) => unique(values, (value) => value)),
)

/** Creates a readable-field capability schema, requiring identity namespaces for a root object. */
function nodeCapability(fields: readonly string[], root: boolean) {
  return v.strictObject({
    fields: fieldNamesSchema(fields),
    identitySources: root ? sources : v.exactOptional(sources),
  })
}

/**
 * Parses declared contexts, field capabilities, relation scopes and image lookup descriptions.
 *
 * Declaration validation does not establish current account or service availability.
 */
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
            ? v.strictObject({ fields: fieldNamesSchema(metadataRelationFields[relation]), scope })
            : v.strictObject({ fields: fieldNamesSchema(metadataRelationFields[relation]) })
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
              v.strictObject({ fields: fieldNamesSchema(['description', 'isNsfw']) }),
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

/**
 * Checks localized metadata, capabilities and the presence of promised implementation methods.
 *
 * Call boundaries validate actual arguments and results when those methods execute.
 */
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

/**
 * Parses a search request while preserving cursor presence, including a source-defined empty token.
 */
export function parseMetadataSearchInput(input: unknown): MetadataSearchInput {
  return parseValue(
    v.strictObject({ entryType: v.picklist(entryTypes), query: text, ...paging }),
    input,
    'Invalid metadata search',
  )
}

/** Parses kind-specific source-location clues and language preferences. */
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

/** Parses a source-session context with an optional root identity. */
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

/** Parses image lookup text, paging and an image use supported by the selected entry kind. */
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

/** Parses a source page and requires every returned record to match the requested entry kind. */
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

/** Parses one of the four resolution outcomes and checks every returned record's entry kind. */
export function parseMetadataResolveResult<T extends EntryType>(
  root: T,
  input: unknown,
): MetadataResolveResult<T> {
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

  return value as MetadataResolveResult<T>
}

/**
 * Parses image candidates and continuation state, retaining each resource's original and preview
 * policies.
 */
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
