import type { NonEmptyArray, ExecutionContext, CallOptions, Registration } from '../operations'
import type { MetadataReadRequest } from './requests'
import type { MetadataReadResult } from './responses'
import * as v from 'valibot'
import {
  languageSchema,
  identitySchema,
  entryTypes,
  type EntryType,
  type ExternalIdentity,
} from '../library/catalog'
import {
  fromParser,
  text,
  unique,
  parseExternalValue,
  parseValue,
  nonemptyText,
} from '../validation'
import {
  fieldNamesSchema,
  getMetadataEntryFields,
  getMetadataPartFields,
  parseIdentificationClues,
  parseSourceEntry,
  parseImageCandidate,
  type SourceEntry,
  type IdentificationClues,
  type MetadataImageField,
  type ImageCandidate,
  type MetadataEntryField,
  type MetadataPartField,
} from './fields'
import { metadataPartKinds, type MetadataPartKey, type MetadataPartType } from './objects'
import {
  getMetadataRelations,
  parseMetadataRelationScope,
  metadataRelationFields,
  type MetadataRelationKey,
  type MetadataRelationAttributeValues,
  type MetadataRelationScopeValues,
  type MetadataSessionRelationScopes,
  type ScopedMetadataRelationKey,
} from './relations'
import {
  normalizeLocalizedText,
  type LocalizedText,
} from '@kisaki3/extension-distribution/metadata'
import { DesktopError } from '../errors'

/** The cursor is opaque and belongs to this provider, entry kind, query and language tuple. */
export interface MetadataSearchInput<T extends EntryType = EntryType> {
  readonly entryType: T
  readonly query: string
  readonly cursor?: string
  readonly preferredLanguages?: readonly string[]
}

/** Cursor absence marks completion. An empty page can still have a continuation. */
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

/** A candidates result contains the complete usable range for that resolve operation. */
export type MetadataResolveResult<T extends EntryType = EntryType> =
  | { readonly type: 'resolved'; readonly record: SourceEntry<T> }
  | { readonly type: 'candidates'; readonly records: readonly SourceEntry<T>[] }
  | { readonly type: 'notFound' }
  | { readonly type: 'insufficientInput' }

/**
 * Omit the root identity when explicitly requesting related entries or parts without root context.
 */
export interface MetadataOpenSessionInput<T extends EntryType = EntryType> {
  readonly entryType: T
  readonly identity?: ExternalIdentity
  readonly preferredLanguages?: readonly string[]
}

/**
 * The provider documents whether it accepts names, resource coordinates or links for this image
 * use.
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

/** Continue as directed by a cursor, including when the current page is empty. */
export interface MetadataImageSearchResult {
  readonly images: readonly ImageCandidate[]
  readonly nextCursor?: string
}

/** Without identitySources, related reads depend on the actual source context. */
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

/** Each image use declares a localized description of its accepted source coordinates. */
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

  /** Overlapping reads share the session context and have independent cancellation. */
  read(request: MetadataReadRequest<T>, context: ExecutionContext): Promise<MetadataReadResult<T>>

  /**
   * Close rejects new reads, waits for accepted reads and releases resources. It is idempotent and
   * uses a separate lifetime from individual read signals.
   */
  close(): Promise<void>
}

/** The provider owns its account and cache policy. The host decides local adoption. */
export interface MetadataProvider<T extends EntryType = EntryType> {
  readonly name: LocalizedText
  readonly description?: LocalizedText
  readonly capabilities: MetadataProviderCapabilities<T>

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

  /** Failed setup releases any resources it already acquired. */
  openSession?(
    input: MetadataOpenSessionInput<T>,
    context: ExecutionContext,
  ): Promise<MetadataReadSession<T>>

  /** The host owns adoption of returned image candidates. */
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

/** The SDK prefixes local IDs with the actual extension owner's identity. */
export interface MetadataProvidersApi {
  list(call?: CallOptions): Promise<readonly MetadataProviderDescriptor[]>

  get(providerId: string, call?: CallOptions): Promise<MetadataProviderDescriptor | null>

  /**
   * Registers for the actual owner and instance and returns a removal handle. Duplicate identities
   * fail.
   */
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

const sources = v.pipe(
  v.tupleWithRest([identitySchema.entries.source], identitySchema.entries.source),
  v.check((values) => unique(values, (value) => value)),
)

function nodeCapability(fields: readonly string[], root: boolean) {
  return v.strictObject({
    fields: fieldNamesSchema(fields),
    identitySources: root ? sources : v.exactOptional(sources),
  })
}

/** Declaration validation leaves account and service availability to execution. */
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
          const scope = fromParser((value) =>
            value === null || value === 'session'
              ? value
              : parseMetadataRelationScope(root, relation as ScopedMetadataRelationKey, value),
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
              queryDescription: fromParser((value) =>
                parseExternalValue(
                  (input) => normalizeLocalizedText(input, defaultLocale),
                  value,
                  'Invalid image lookup description',
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
 * Checks promised methods and their declarations. Calls validate their actual arguments and
 * results.
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

/** Preserves the presence of a continuation token, including a source-defined empty token. */
export function parseMetadataSearchInput(input: unknown): MetadataSearchInput {
  return parseValue(
    v.strictObject({ entryType: v.picklist(entryTypes), query: text, ...paging }),
    input,
    'Invalid metadata search',
  )
}

export function parseMetadataResolveInput(input: unknown): MetadataResolveInput {
  const { entryType } = parseValue(v.looseObject({ entryType: v.picklist(entryTypes) }), input)
  return parseValue(
    v.strictObject({
      entryType: v.literal(entryType),
      clues: fromParser((value) => parseIdentificationClues(entryType, value)),
      preferredLanguages: v.exactOptional(languages),
    }),
    input,
    'Invalid metadata resolve input',
  ) as MetadataResolveInput
}

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

/** Every returned record must match the requested entry kind. */
export function parseMetadataSearchResult<T extends EntryType>(
  root: T,
  input: unknown,
): MetadataSearchResult<T> {
  const value = parseValue(
    v.strictObject({
      records: v.array(fromParser(parseSourceEntry)),
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

export function parseMetadataResolveResult<T extends EntryType>(
  root: T,
  input: unknown,
): MetadataResolveResult<T> {
  const entry = fromParser(parseSourceEntry)
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
      images: v.array(fromParser(parseImageCandidate)),
      nextCursor: v.exactOptional(text),
    }),
    input,
    'Invalid metadata image result',
  )
}
