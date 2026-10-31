/** @fileoverview Owns the finite source-field catalog and its values without local write or identity fields. */

import * as v from 'valibot'
import { imageCandidateSchema, type ImageCandidate } from '../images'
import { entryMetadataFields, type EntryMetadataByType } from '../library/catalog'
import type { EntryType, PartType, WorkType } from '../library/identity'
import { partMetadataFields, type PartMetadataByType } from '../library/parts'
import { objectSchema } from '../schema'
import { exactPartialEntries, parseContract, type FieldSchemas } from '../validation'
import type { MetadataRelation, MetadataRelationAttributes } from './relations'

type LocalEntryField =
  | 'sortName'
  | 'addedDate'
  | 'externalIdentities'
  | 'primaryImageId'
  | 'backdropImageId'
  | 'titleLogoId'
  | 'iconImageId'
/** Complete field value catalog; missing answers are represented by optional fields in the containing answer. */
export type MetadataEntryValuesByType = {
  [Type in EntryType]: Omit<EntryMetadataByType[Type], LocalEntryField> & {
    readonly primaryImage: readonly ImageCandidate[]
  } & (Type extends WorkType
      ? {
          readonly backdropImage: readonly ImageCandidate[]
          readonly titleLogo: readonly ImageCandidate[]
        }
      : object) &
    (Type extends 'game' ? { readonly iconImage: readonly ImageCandidate[] } : object)
}
export type MetadataPartValuesByType = {
  [Type in PartType]: Omit<PartMetadataByType[Type], 'externalIdentities' | 'primaryImageId'> & {
    readonly primaryImage: readonly ImageCandidate[]
  }
}
export type MetadataEntryFields<Type extends EntryType = EntryType> = Partial<
  MetadataEntryValuesByType[Type]
>
export type MetadataPartFields<Type extends PartType = PartType> = Partial<
  MetadataPartValuesByType[Type]
>
export type MetadataEntryField<Type extends EntryType> = {
  [Kind in Type]: keyof MetadataEntryValuesByType[Kind]
}[Type]
export type MetadataPartField<Type extends PartType> = {
  [Kind in Type]: keyof MetadataPartValuesByType[Kind]
}[Type]
/** Context keys deliberately retain the root work type; volume never becomes a sixth Part kind. */
export interface MetadataPartKinds {
  readonly game: Record<never, never>
  readonly anime: { readonly episode: 'animeEpisode'; readonly extra: 'animeExtra' }
  readonly comic: { readonly volume: 'comicVolume'; readonly chapter: 'comicChapter' }
  readonly novel: { readonly volume: 'novelVolume' }
  readonly character: Record<never, never>
  readonly person: Record<never, never>
  readonly organization: Record<never, never>
}
export type MetadataPartKey<Type extends EntryType> = keyof MetadataPartKinds[Type]
/** A field identifier carries its object kind and cannot address an arbitrary path or local-only field. */
export type MetadataField =
  | {
      [Type in EntryType]: {
        readonly object: 'entry'
        readonly entryType: Type
        readonly field: MetadataEntryField<Type>
      }
    }[EntryType]
  | {
      [Type in PartType]: {
        readonly object: 'part'
        readonly partType: Type
        readonly field: MetadataPartField<Type>
      }
    }[PartType]
  | { readonly object: 'tag'; readonly field: 'description' | 'isNsfw' }
  | {
      [Key in MetadataRelation]: {
        readonly object: 'relation'
        readonly relation: Key
        readonly field: MetadataRelationAttributes[Key]
      }
    }[MetadataRelation]

const images = v.pipe(v.array(imageCandidateSchema), v.readonly())
const localCommon = ['sortName', 'addedDate', 'externalIdentities', 'primaryImageId'] as const
const localWork = [...localCommon, 'backdropImageId', 'titleLogoId'] as const
export const metadataEntryFields = {
  game: {
    ...v.omit(v.strictObject(entryMetadataFields.game), [...localWork, 'iconImageId']).entries,
    primaryImage: images,
    backdropImage: images,
    titleLogo: images,
    iconImage: images,
  },
  anime: {
    ...v.omit(v.strictObject(entryMetadataFields.anime), localWork).entries,
    primaryImage: images,
    backdropImage: images,
    titleLogo: images,
  },
  comic: {
    ...v.omit(v.strictObject(entryMetadataFields.comic), localWork).entries,
    primaryImage: images,
    backdropImage: images,
    titleLogo: images,
  },
  novel: {
    ...v.omit(v.strictObject(entryMetadataFields.novel), localWork).entries,
    primaryImage: images,
    backdropImage: images,
    titleLogo: images,
  },
  character: {
    ...v.omit(v.strictObject(entryMetadataFields.character), localCommon).entries,
    primaryImage: images,
  },
  person: {
    ...v.omit(v.strictObject(entryMetadataFields.person), localCommon).entries,
    primaryImage: images,
  },
  organization: {
    ...v.omit(v.strictObject(entryMetadataFields.organization), localCommon).entries,
    primaryImage: images,
  },
} satisfies { [Type in EntryType]: FieldSchemas<MetadataEntryValuesByType[Type]> }

const localPart = ['externalIdentities', 'primaryImageId'] as const
export const metadataPartFields = {
  animeEpisode: {
    ...v.omit(v.strictObject(partMetadataFields.animeEpisode), localPart).entries,
    primaryImage: images,
  },
  animeExtra: {
    ...v.omit(v.strictObject(partMetadataFields.animeExtra), localPart).entries,
    primaryImage: images,
  },
  comicVolume: {
    ...v.omit(v.strictObject(partMetadataFields.comicVolume), localPart).entries,
    primaryImage: images,
  },
  comicChapter: {
    ...v.omit(v.strictObject(partMetadataFields.comicChapter), localPart).entries,
    primaryImage: images,
  },
  novelVolume: {
    ...v.omit(v.strictObject(partMetadataFields.novelVolume), localPart).entries,
    primaryImage: images,
  },
} satisfies { [Type in PartType]: FieldSchemas<MetadataPartValuesByType[Type]> }

const entrySchemas: { [Type in EntryType]: v.GenericSchema<unknown, MetadataEntryFields<Type>> } = {
  game: objectSchema(exactPartialEntries(metadataEntryFields.game)),
  anime: objectSchema(exactPartialEntries(metadataEntryFields.anime)),
  comic: objectSchema(exactPartialEntries(metadataEntryFields.comic)),
  novel: objectSchema(exactPartialEntries(metadataEntryFields.novel)),
  character: objectSchema(exactPartialEntries(metadataEntryFields.character)),
  person: objectSchema(exactPartialEntries(metadataEntryFields.person)),
  organization: objectSchema(exactPartialEntries(metadataEntryFields.organization)),
}
const partSchemas: { [Type in PartType]: v.GenericSchema<unknown, MetadataPartFields<Type>> } = {
  animeEpisode: objectSchema(exactPartialEntries(metadataPartFields.animeEpisode)),
  animeExtra: objectSchema(exactPartialEntries(metadataPartFields.animeExtra)),
  comicVolume: objectSchema(exactPartialEntries(metadataPartFields.comicVolume)),
  comicChapter: objectSchema(exactPartialEntries(metadataPartFields.comicChapter)),
  novelVolume: objectSchema(exactPartialEntries(metadataPartFields.novelVolume)),
}

/** Parse a source field answer, preserving missing/null/false/zero and rejecting local write fields. */
export function parseMetadataEntryFields<Type extends EntryType>(
  type: Type,
  input: unknown,
): MetadataEntryFields<Type> {
  return parseContract(entrySchemas[type], input, 'metadata entry fields')
}
/** Parse one Part's source fields, without accepting IDs, ownership, personal completion, or local images. */
export function parseMetadataPartFields<Type extends PartType>(
  type: Type,
  input: unknown,
): MetadataPartFields<Type> {
  return parseContract(partSchemas[type], input, 'metadata part fields')
}
