/** @fileoverview Defines source providers, finite read requests, complete source answers, and owned read sessions. */

import * as v from 'valibot'
import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { CallOptions, Disposable, ParticipationContext, Registration } from '../execution'
import { invalidInput } from '../errors'
import type { ImageCandidate } from '../images'
import { externalIdentitiesSchema } from '../library/catalog'
import type { EntryType, ExternalIdentity, PartType } from '../library/identity'
import { objectSchema } from '../schema'
import { exactPartialEntries, nonemptyStringSchema, parseContract } from '../validation'
import {
  candidateTagSchema,
  sourceIdentityFields,
  validateSourceGraph,
  type CandidateTag,
} from './candidate'
import {
  metadataEntryFields,
  metadataPartFields,
  type MetadataEntryField,
  type MetadataEntryFields,
  type MetadataPartField,
  type MetadataPartFields,
} from './fields'
import type { IdentificationClues, IdentificationFields } from './identification'
import {
  candidateRelationSchemas,
  type CandidateRelations,
  type MetadataRelationAttributes,
  type MetadataRelationKey,
  type MetadataRelationScopeValues,
  type MetadataSessionScopes,
} from './relations'

/** A provider's actual source record and raw identification, independent of local adoption. */
export type SourceEntry<Type extends EntryType = EntryType> = {
  [Kind in Type]: {
    readonly type: Kind
    readonly identity: ExternalIdentity
    readonly identification: IdentificationFields<Kind>
    readonly externalIdentities?: readonly ExternalIdentity[]
  }
}[Type]
export interface MetadataSearchInput<Type extends EntryType = EntryType> {
  readonly entryType: Type
  readonly query: string
  readonly cursor?: string
  readonly preferredLanguages?: readonly string[]
}
export interface MetadataSearchResult<Type extends EntryType = EntryType> {
  readonly records: readonly SourceEntry<Type>[]
  readonly nextCursor?: string
}
export interface MetadataResolveInput<Type extends EntryType = EntryType> {
  readonly entryType: Type
  readonly clues: IdentificationClues<Type>
  readonly preferredLanguages?: readonly string[]
}
/** A single name hit remains candidates; resolved requires a real identity or source mapping. */
export type ResolveResult<Type extends EntryType = EntryType> =
  | { readonly type: 'resolved'; readonly record: SourceEntry<Type> }
  | { readonly type: 'candidates'; readonly records: readonly SourceEntry<Type>[] }
  | { readonly type: 'notFound' | 'insufficientInput' }
export interface MetadataOpenInput<Type extends EntryType = EntryType> {
  readonly entryType: Type
  readonly identity?: ExternalIdentity
  readonly preferredLanguages?: readonly string[]
}

interface EntryReadRequest<Type extends EntryType> {
  readonly fields: readonly MetadataEntryField<Type>[]
  readonly refs?: readonly ExternalIdentity[]
}
interface PartReadRequest<Type extends PartType> {
  readonly fields: readonly MetadataPartField<Type>[]
  readonly refs?: readonly ExternalIdentity[]
}
export type MetadataPartRequests<Type extends EntryType> = {
  game: never
  anime: {
    readonly episode?: PartReadRequest<'animeEpisode'>
    readonly extra?: PartReadRequest<'animeExtra'>
  }
  comic: {
    readonly volume?: PartReadRequest<'comicVolume'>
    readonly chapter?: PartReadRequest<'comicChapter'>
  }
  novel: { readonly volume?: PartReadRequest<'novelVolume'> }
  character: never
  person: never
  organization: never
}[Type]
/** Appearing relation nodes request members even with fields: []; omitted nodes request nothing. */
export interface MetadataReadRequest<Type extends EntryType = EntryType> {
  readonly objects?: {
    readonly entry?: Pick<EntryReadRequest<Type>, 'fields'>
    readonly relatedEntries?: { readonly [Kind in EntryType]?: EntryReadRequest<Kind> }
    readonly parts?: MetadataPartRequests<Type>
    readonly tags?: {
      readonly fields: readonly ('description' | 'isNsfw')[]
      readonly names?: readonly string[]
    }
  }
  readonly relations?: {
    readonly [Key in MetadataRelationKey<Type>]?: {
      readonly fields: readonly MetadataRelationAttributes[Key][]
    }
  }
}
interface SourceObject {
  readonly key: string
  readonly identity?: ExternalIdentity
  readonly externalIdentities?: readonly ExternalIdentity[]
}
export type MetadataEntryAnswer<Type extends EntryType> = SourceObject & MetadataEntryFields<Type>
export type MetadataPartAnswer<Type extends PartType> = SourceObject & MetadataPartFields<Type>
export type MetadataPartAnswers<Type extends EntryType> = {
  game: never
  anime: {
    readonly episode?: readonly MetadataPartAnswer<'animeEpisode'>[]
    readonly extra?: readonly MetadataPartAnswer<'animeExtra'>[]
  }
  comic: {
    readonly volume?: readonly MetadataPartAnswer<'comicVolume'>[]
    readonly chapter?: readonly MetadataPartAnswer<'comicChapter'>[]
  }
  novel: { readonly volume?: readonly MetadataPartAnswer<'novelVolume'>[] }
  character: never
  person: never
  organization: never
}[Type]
/** Source fields are flat; absence means unanswered and every returned relationship array is complete for its session scope. */
export interface MetadataReadResult<Type extends EntryType = EntryType> {
  readonly objects?: {
    readonly entry?: MetadataEntryAnswer<Type>
    readonly relatedEntries?: {
      readonly [Kind in EntryType]?: readonly MetadataEntryAnswer<Kind>[]
    }
    readonly parts?: MetadataPartAnswers<Type>
    readonly tags?: readonly CandidateTag[]
  }
  readonly relations?: CandidateRelations<Type>
}
/** The caller closes every acquired session; concurrent reads have independent cancellation and one fixed scope snapshot. */
export interface MetadataReadSession<Type extends EntryType = EntryType> {
  readonly relationScopes: MetadataSessionScopes<Type>
  /** Read only the requested source facts; a failure may carry a valid answer containing completed independent facts. */
  read(
    request: MetadataReadRequest<Type>,
    context: ParticipationContext,
  ): Promise<MetadataReadResult<Type>>
  /** Reject new reads, wait for accepted reads and release resources. Repeated calls share the same close result. */
  close(): Promise<void>
}

export type MetadataImageField<Type extends EntryType> = Extract<
  MetadataEntryField<Type>,
  'primaryImage' | 'backdropImage' | 'iconImage' | 'titleLogo'
>
export interface MetadataImageSearchInput<
  Type extends EntryType = EntryType,
> extends MetadataSearchInput<Type> {
  readonly field: MetadataImageField<Type>
}
export interface MetadataImageSearchResult {
  readonly images: readonly ImageCandidate[]
  readonly nextCursor?: string
}
interface EntryReadCapability<Type extends EntryType> {
  readonly fields: readonly MetadataEntryField<Type>[]
  readonly identitySources?: readonly string[]
}
interface PartReadCapability<Type extends PartType> {
  readonly fields: readonly MetadataPartField<Type>[]
  readonly identitySources?: readonly string[]
}
type PartCapabilities<Type extends EntryType> = {
  game: never
  anime: {
    readonly episode?: PartReadCapability<'animeEpisode'>
    readonly extra?: PartReadCapability<'animeExtra'>
  }
  comic: {
    readonly volume?: PartReadCapability<'comicVolume'>
    readonly chapter?: PartReadCapability<'comicChapter'>
  }
  novel: { readonly volume?: PartReadCapability<'novelVolume'> }
  character: never
  person: never
  organization: never
}[Type]
export interface MetadataReadCapabilities<Type extends EntryType> {
  readonly objects?: {
    readonly entry?: EntryReadCapability<Type>
    readonly relatedEntries?: { readonly [Kind in EntryType]?: EntryReadCapability<Kind> }
    readonly parts?: PartCapabilities<Type>
    readonly tags?: { readonly fields: readonly ('description' | 'isNsfw')[] }
  }
  readonly relations?: {
    readonly [Key in MetadataRelationKey<Type>]?: {
      readonly fields: readonly MetadataRelationAttributes[Key][]
    } & (Key extends 'workCharacters' | 'personWorks' | 'organizationWorks' | 'workRelations'
      ? { readonly scope: MetadataRelationScopeValues[Key] | null | 'session' }
      : object)
  }
}
export type MetadataProviderCapabilities = {
  readonly [Type in EntryType]?: {
    readonly search?: true
    readonly resolve?: true
    readonly read?: MetadataReadCapabilities<Type>
    readonly images?: readonly MetadataImageField<Type>[]
  }
}
export interface MetadataProviderDescription {
  readonly id: string
  readonly name: LocalizedText
  readonly description?: LocalizedText
  readonly capabilities: MetadataProviderCapabilities
}
/** The native registration uses a full ID. The extension API changes only ID binding to an instance-local ID. */
export interface MetadataProvider extends MetadataProviderDescription {
  /** Return one independently paginated source group; a cursor belongs to the unchanged input conditions. */
  search?(input: MetadataSearchInput, context: ParticipationContext): Promise<MetadataSearchResult>
  /** Finish necessary source lookup before returning candidates; no public paging or weak automatic selection. */
  resolve?(input: MetadataResolveInput, context: ParticipationContext): Promise<ResolveResult>
  /** Establish fixed language and relationship coverage; root identity may be absent for explicit refs-only reads. */
  openSession?(
    input: MetadataOpenInput,
    context: ParticipationContext,
  ): Promise<MetadataReadSession>
  /** Browse original images and optional image previews, without adopting source identities or attachments. */
  searchImages?(
    input: MetadataImageSearchInput,
    context: ParticipationContext,
  ): Promise<MetadataImageSearchResult>
}
export interface MetadataProvidersApi {
  /** Return currently registered descriptions; unavailable saved selections are not silently replaced. */
  list(call?: CallOptions): Promise<readonly MetadataProviderDescription[]>
  /** Read an actual registration, or null when the stable ID is unavailable. */
  get(id: string, call?: CallOptions): Promise<MetadataProviderDescription | null>
  /** Register a complete implementation; withdrawal affects future discovery, not already bound operations. */
  register(provider: MetadataProvider, call?: CallOptions): Promise<Registration<string>>
  /** Observe catalog invalidation without delivering ongoing source request progress. */
  onInvalidated(listener: () => void): Disposable
}

function fieldsRequest<Entries extends v.ObjectEntries>(fields: Entries, related = false) {
  const selected = v.pipe(
    v.array(v.keyof(v.strictObject(fields))),
    v.check((values) => new Set(values).size === values.length),
    v.readonly(),
  )
  return related
    ? objectSchema({ fields: selected, refs: v.exactOptional(externalIdentitiesSchema) })
    : objectSchema({ fields: selected })
}
const entryRequests = {
  game: fieldsRequest(metadataEntryFields.game),
  anime: fieldsRequest(metadataEntryFields.anime),
  comic: fieldsRequest(metadataEntryFields.comic),
  novel: fieldsRequest(metadataEntryFields.novel),
  character: fieldsRequest(metadataEntryFields.character),
  person: fieldsRequest(metadataEntryFields.person),
  organization: fieldsRequest(metadataEntryFields.organization),
}
const relatedRequests = objectSchema(
  exactPartialEntries({
    game: fieldsRequest(metadataEntryFields.game, true),
    anime: fieldsRequest(metadataEntryFields.anime, true),
    comic: fieldsRequest(metadataEntryFields.comic, true),
    novel: fieldsRequest(metadataEntryFields.novel, true),
    character: fieldsRequest(metadataEntryFields.character, true),
    person: fieldsRequest(metadataEntryFields.person, true),
    organization: fieldsRequest(metadataEntryFields.organization, true),
  }),
)
const partRequests = {
  anime: objectSchema(
    exactPartialEntries({
      episode: fieldsRequest(metadataPartFields.animeEpisode, true),
      extra: fieldsRequest(metadataPartFields.animeExtra, true),
    }),
  ),
  comic: objectSchema(
    exactPartialEntries({
      volume: fieldsRequest(metadataPartFields.comicVolume, true),
      chapter: fieldsRequest(metadataPartFields.comicChapter, true),
    }),
  ),
  novel: objectSchema(
    exactPartialEntries({ volume: fieldsRequest(metadataPartFields.novelVolume, true) }),
  ),
}
function relationRequest<const Keys extends readonly string[]>(keys: Keys) {
  return objectSchema({
    fields: v.pipe(
      v.array(v.picklist(keys)),
      v.check((values) => new Set(values).size === values.length),
      v.readonly(),
    ),
  })
}
export const relationRequestFields = {
  workCharacters: relationRequest(['role', 'note', 'isSpoiler']),
  personWorks: relationRequest(['note', 'isSpoiler']),
  organizationWorks: relationRequest(['note', 'isSpoiler']),
  workRelations: relationRequest(['note']),
  entryTags: relationRequest(['note', 'isSpoiler']),
  volumeChapters: relationRequest(['numberLabel']),
  workVolumes: relationRequest([]),
  workChapters: relationRequest([]),
  workEpisodes: relationRequest([]),
  workExtras: relationRequest([]),
}
const relationRequests = v.strictObject(exactPartialEntries(relationRequestFields))
function readRequest<Entry, Parts, Relations>(
  entry: v.GenericSchema<unknown, Entry>,
  parts: v.GenericSchema<unknown, Parts>,
  relations: v.GenericSchema<unknown, Relations>,
) {
  return objectSchema({
    objects: v.exactOptional(
      objectSchema({
        entry: v.exactOptional(entry),
        relatedEntries: v.exactOptional(relatedRequests),
        parts: v.exactOptional(parts),
        tags: v.exactOptional(
          objectSchema({
            fields: v.pipe(v.array(v.picklist(['description', 'isNsfw'])), v.readonly()),
            names: v.exactOptional(v.pipe(v.array(nonemptyStringSchema), v.readonly())),
          }),
        ),
      }),
    ),
    relations: v.exactOptional(relations),
  })
}
const workKeys = [
  'workCharacters',
  'personWorks',
  'organizationWorks',
  'workRelations',
  'entryTags',
] as const
export const metadataReadRequestSchemas: {
  [Type in EntryType]: v.GenericSchema<unknown, MetadataReadRequest<Type>>
} = {
  game: readRequest(
    entryRequests.game,
    v.never(),
    objectSchema(v.pick(relationRequests, workKeys).entries),
  ),
  anime: readRequest(
    entryRequests.anime,
    partRequests.anime,
    objectSchema(v.pick(relationRequests, [...workKeys, 'workEpisodes', 'workExtras']).entries),
  ),
  comic: readRequest(
    entryRequests.comic,
    partRequests.comic,
    objectSchema(
      v.pick(relationRequests, [...workKeys, 'workVolumes', 'workChapters', 'volumeChapters'])
        .entries,
    ),
  ),
  novel: readRequest(
    entryRequests.novel,
    partRequests.novel,
    objectSchema(v.pick(relationRequests, [...workKeys, 'workVolumes']).entries),
  ),
  character: readRequest(
    entryRequests.character,
    v.never(),
    objectSchema(v.pick(relationRequests, ['workCharacters', 'personWorks', 'entryTags']).entries),
  ),
  person: readRequest(
    entryRequests.person,
    v.never(),
    objectSchema(v.pick(relationRequests, ['personWorks', 'entryTags']).entries),
  ),
  organization: readRequest(
    entryRequests.organization,
    v.never(),
    objectSchema(v.pick(relationRequests, ['organizationWorks', 'entryTags']).entries),
  ),
}
function entryAnswer<Entries extends v.ObjectEntries>(fields: Entries) {
  return objectSchema({ ...sourceIdentityFields, ...exactPartialEntries(fields) })
}
const entryAnswers = {
  game: entryAnswer(metadataEntryFields.game),
  anime: entryAnswer(metadataEntryFields.anime),
  comic: entryAnswer(metadataEntryFields.comic),
  novel: entryAnswer(metadataEntryFields.novel),
  character: entryAnswer(metadataEntryFields.character),
  person: entryAnswer(metadataEntryFields.person),
  organization: entryAnswer(metadataEntryFields.organization),
}
const relatedAnswers = objectSchema(
  exactPartialEntries({
    game: v.pipe(v.array(entryAnswers.game), v.readonly()),
    anime: v.pipe(v.array(entryAnswers.anime), v.readonly()),
    comic: v.pipe(v.array(entryAnswers.comic), v.readonly()),
    novel: v.pipe(v.array(entryAnswers.novel), v.readonly()),
    character: v.pipe(v.array(entryAnswers.character), v.readonly()),
    person: v.pipe(v.array(entryAnswers.person), v.readonly()),
    organization: v.pipe(v.array(entryAnswers.organization), v.readonly()),
  }),
)
const partAnswers = {
  anime: objectSchema(
    exactPartialEntries({
      episode: v.pipe(v.array(entryAnswer(metadataPartFields.animeEpisode)), v.readonly()),
      extra: v.pipe(v.array(entryAnswer(metadataPartFields.animeExtra)), v.readonly()),
    }),
  ),
  comic: objectSchema(
    exactPartialEntries({
      volume: v.pipe(v.array(entryAnswer(metadataPartFields.comicVolume)), v.readonly()),
      chapter: v.pipe(v.array(entryAnswer(metadataPartFields.comicChapter)), v.readonly()),
    }),
  ),
  novel: objectSchema(
    exactPartialEntries({
      volume: v.pipe(v.array(entryAnswer(metadataPartFields.novelVolume)), v.readonly()),
    }),
  ),
}
function readResult<Entry, Parts, Relations>(
  entry: v.GenericSchema<unknown, Entry>,
  parts: v.GenericSchema<unknown, Parts>,
  relations: v.GenericSchema<unknown, Relations>,
) {
  return objectSchema({
    objects: v.exactOptional(
      objectSchema({
        entry: v.exactOptional(entry),
        relatedEntries: v.exactOptional(relatedAnswers),
        parts: v.exactOptional(parts),
        tags: v.exactOptional(v.pipe(v.array(candidateTagSchema), v.readonly())),
      }),
    ),
    relations: v.exactOptional(relations),
  })
}
const resultSchemas: { [Type in EntryType]: v.GenericSchema<unknown, MetadataReadResult<Type>> } = {
  game: readResult(entryAnswers.game, v.never(), candidateRelationSchemas.game),
  anime: readResult(entryAnswers.anime, partAnswers.anime, candidateRelationSchemas.anime),
  comic: readResult(entryAnswers.comic, partAnswers.comic, candidateRelationSchemas.comic),
  novel: readResult(entryAnswers.novel, partAnswers.novel, candidateRelationSchemas.novel),
  character: readResult(entryAnswers.character, v.never(), candidateRelationSchemas.character),
  person: readResult(entryAnswers.person, v.never(), candidateRelationSchemas.person),
  organization: readResult(
    entryAnswers.organization,
    v.never(),
    candidateRelationSchemas.organization,
  ),
}

/** Validate a finite source request without turning an empty refs list into an unbounded read. */
export function parseMetadataReadRequest<Type extends EntryType>(
  type: Type,
  input: unknown,
): MetadataReadRequest<Type> {
  return parseContract(metadataReadRequestSchemas[type], input, 'metadata read request')
}
/** Validate flat source answers and one answer's endpoint graph; source coverage is fixed before the read. */
export function parseMetadataReadResult<Type extends EntryType>(
  type: Type,
  input: unknown,
): MetadataReadResult<Type> {
  const result = parseContract(resultSchemas[type], input, 'metadata read result')
  validateSourceGraph(type, result.objects ?? {}, result.relations ?? {})
  return result
}

/** Reject a declared behavior without its implementation before publishing a provider. */
export function validateProviderMethods(provider: MetadataProvider): void {
  for (const capability of Object.values(provider.capabilities)) {
    if (
      (capability.search && typeof provider.search !== 'function') ||
      (capability.resolve && typeof provider.resolve !== 'function') ||
      (capability.read && typeof provider.openSession !== 'function') ||
      (capability.images?.length && typeof provider.searchImages !== 'function')
    ) {
      invalidInput('A declared provider capability has no implementation.')
    }
  }
}
