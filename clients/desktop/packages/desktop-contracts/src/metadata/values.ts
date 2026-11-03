/** @fileoverview Defines type-correlated metadata requests, source responses, composed candidates and matching rules. */

import type { NonEmptyArray } from '../operations'
import type { EntryType, ExternalIdentity, PartType } from '../library/catalog'
import type {
  IdentificationFields,
  MetadataEntryField,
  MetadataEntryFields,
  MetadataPartField,
  MetadataPartFields,
  PartIdentificationFields,
} from './fields'
import type {
  MetadataRelationAttributeValues,
  MetadataRelationKey,
  MetadataRelations,
} from './relations'

/** Only these part slots exist in a root context; they do not introduce independent Part search or resolve roots. */
export interface MetadataPartKinds {
  readonly game: Readonly<Record<never, never>>
  readonly anime: { readonly episode: 'animeEpisode'; readonly extra: 'animeExtra' }
  readonly comic: { readonly volume: 'comicVolume'; readonly chapter: 'comicChapter' }
  readonly novel: { readonly volume: 'novelVolume' }
  readonly character: Readonly<Record<never, never>>
  readonly person: Readonly<Record<never, never>>
  readonly organization: Readonly<Record<never, never>>
}
export type MetadataPartKey<T extends EntryType> = keyof MetadataPartKinds[T]
export type MetadataPartType<T extends EntryType, K extends MetadataPartKey<T>> = Extract<
  MetadataPartKinds[T][K],
  PartType
>
export type EntryMatchingField<T extends EntryType> = Extract<keyof IdentificationFields<T>, string>
export type PartMatchingField<T extends PartType> =
  | Extract<keyof PartIdentificationFields<T>, string>
  | (T extends 'comicChapter' ? 'volumeNumberLabel' : never)
/** Every field must have an original comparable value. Only zero matches advances to the next ordered fallback rule. */
export interface MatchingRule<Field extends PropertyKey> {
  readonly fields: NonEmptyArray<Field>
}
export type PartMatchingRules<T extends EntryType> = {
  readonly [K in MetadataPartKey<T>]?: readonly MatchingRule<
    PartMatchingField<MetadataPartType<T, K>>
  >[]
}
export type MetadataMatchingRules<T extends EntryType> = {
  readonly [K in EntryType]?: readonly MatchingRule<EntryMatchingField<K>>[]
} & PartMatchingRules<T>

interface ObjectFieldRequest<Field extends PropertyKey> {
  readonly fields: readonly Field[]
  readonly refs?: readonly ExternalIdentity[]
}
export type MetadataRelatedEntryRequests = {
  readonly [K in EntryType]?: ObjectFieldRequest<MetadataEntryField<K>>
}
export type MetadataPartRequests<T extends EntryType> = {
  readonly [K in MetadataPartKey<T>]?: ObjectFieldRequest<MetadataPartField<MetadataPartType<T, K>>>
}
/** An empty fields array requests no ordinary properties, while refs:[] explicitly selects no object fields. */
export type MetadataReadRequest<T extends EntryType = EntryType> = {
  [K in T]: {
    readonly objects?: {
      readonly entry?: { readonly fields: readonly MetadataEntryField<K>[] }
      readonly relatedEntries?: MetadataRelatedEntryRequests
      readonly tags?: {
        readonly fields: readonly ('description' | 'isNsfw')[]
        readonly names?: readonly string[]
      }
    } & (K extends 'anime' | 'comic' | 'novel'
      ? { readonly parts?: MetadataPartRequests<K> }
      : object)
    readonly relations?: {
      readonly [R in MetadataRelationKey<K>]?: {
        readonly fields: readonly (keyof MetadataRelationAttributeValues[R])[]
      }
    }
  }
}[T]

/** Provider values are direct field answers; primary/additional identities are supplied whenever genuinely known. */
export interface MetadataObjectIdentity {
  readonly key: string
  readonly identity?: ExternalIdentity
  readonly externalIdentities?: readonly ExternalIdentity[]
}
export type MetadataReadEntry<T extends EntryType> = MetadataObjectIdentity & MetadataEntryFields<T>
export type MetadataReadPart<T extends PartType> = MetadataObjectIdentity & MetadataPartFields<T>
export interface CandidateTag {
  readonly key: string
  readonly name: string
  readonly description?: string | null
  readonly isNsfw?: boolean
}
export type MetadataReadRelatedEntries = {
  readonly [K in EntryType]?: readonly MetadataReadEntry<K>[]
}
export type MetadataReadParts<T extends EntryType> = {
  readonly [K in MetadataPartKey<T>]?: readonly MetadataReadPart<MetadataPartType<T, K>>[]
}
/** Omitted fields and relations are unanswered. Successful arrays are complete for the predeclared session scope. */
export type MetadataReadResult<T extends EntryType = EntryType> = {
  [K in T]: {
    readonly objects?: {
      readonly entry?: MetadataReadEntry<K>
      readonly relatedEntries?: MetadataReadRelatedEntries
      readonly tags?: readonly CandidateTag[]
    } & (K extends 'anime' | 'comic' | 'novel' ? { readonly parts?: MetadataReadParts<K> } : object)
    readonly relations?: MetadataRelations<K>
  }
}[T]

/** Composed fields are adoptable values; identification retains only original, unprocessed matching evidence. */
export interface CandidateEntry<T extends EntryType> extends MetadataObjectIdentity {
  readonly identification: IdentificationFields<T>
  readonly fields: MetadataEntryFields<T>
}
export interface CandidatePart<T extends PartType> extends MetadataObjectIdentity {
  readonly identification: PartIdentificationFields<T>
  readonly fields: MetadataPartFields<T>
}
export type CandidateRelatedEntries = { readonly [K in EntryType]?: readonly CandidateEntry<K>[] }
export type CandidateParts<T extends EntryType> = {
  readonly [K in MetadataPartKey<T>]?: readonly CandidatePart<MetadataPartType<T, K>>[]
}
/** One root and one request-local key space; local IDs, write flags and personal data are never metadata candidates. */
export type MetadataCandidate<T extends EntryType = EntryType> = {
  [K in T]: {
    readonly entryType: K
    readonly objects: {
      readonly entry: CandidateEntry<K>
      readonly relatedEntries?: CandidateRelatedEntries
      readonly tags?: readonly CandidateTag[]
    } & (K extends 'anime' | 'comic' | 'novel' ? { readonly parts?: CandidateParts<K> } : object)
    readonly relations?: MetadataRelations<K>
  } & (K extends 'anime' | 'comic' | 'novel'
    ? { readonly partMatching?: PartMatchingRules<K> }
    : object)
}[T]

/** Actual root-specific part kinds are shared by all metadata directories, avoiding copied volume meanings. */
export const metadataPartKinds: MetadataPartKinds = {
  game: {},
  anime: { episode: 'animeEpisode', extra: 'animeExtra' },
  comic: { volume: 'comicVolume', chapter: 'comicChapter' },
  novel: { volume: 'novelVolume' },
  character: {},
  person: {},
  organization: {},
}
