/** @fileoverview Owns metadata field values and original identification clues, separate from local write intent and personal data. */

import type { FileInput } from '../resources'
import type {
  EntryType,
  EntryFields,
  WorkType,
  PartType,
  Gender,
  AnimeExtraType,
  AnimeEpisodeType,
  ExternalIdentity,
} from '../library/catalog'
import type { PartFields } from '../library/parts'
import type { MetadataRelationAttributeValues, MetadataRelationMembers } from './relations'
import type { PartialDate } from '../date'
import * as v from 'valibot'
import { parseFileInput } from '../resources'
import {
  identitySchema,
  languageSchema,
  entryCommonEntries,
  entrySpecificEntries,
  partialDateSchema,
  genderSchema,
  identitiesSchema,
  entryTypes,
  identityKey,
} from '../library/catalog'
import {
  id,
  positiveInteger,
  text,
  nonemptyText,
  omitFields,
  parseValue,
  optionalFields,
  unique,
} from '../validation'
import { characterRoles } from '../library/relations'
import { partCommonEntries, partSpecificEntries } from '../library/parts'
import { DesktopError } from '../errors'
import { metadataRelationFields } from './relations'

/** Source-scoped image identity independent of catalog entry and part identities. */
export interface ImageIdentity {
  readonly source: string
  readonly id: string
}

/**
 * Unadopted image source with an optional preview, source identity and display metadata.
 *
 * Original and preview resources retain separate redirect policies. Claimed dimensions are hints
 * until the image is decoded.
 */
export interface ImageCandidate {
  readonly image: FileInput
  readonly thumbnail?: FileInput
  readonly identity?: ImageIdentity

  /** Source-reported image width in pixels. */
  readonly width?: number
  /** Source-reported image height in pixels. */
  readonly height?: number

  readonly label?: string
  readonly sourceCategory?: string
  /** Omission is unknown; [] means the source explicitly identifies the image as language-neutral. */
  readonly languages?: readonly string[]
  /** Source uploader/provider credits, never catalog people or a claim of original rights ownership. */
  readonly credits?: readonly { readonly name: string; readonly url?: string }[]
}

/** Saved image-ID fields replaced by source candidates in metadata values. */
type CatalogImageFields = 'primaryImageId' | 'backdropImageId' | 'titleLogoId' | 'iconImageId'

/**
 * Metadata field value types for each entry kind, using source candidates for images.
 *
 * Other fields retain their catalog meanings; local sort, added-date and external-identity storage
 * fields are excluded.
 */
export type MetadataEntryFieldValues = {
  [K in EntryType]: Omit<
    EntryFields<K>,
    'sortName' | 'addedDate' | 'externalIdentities' | CatalogImageFields
  > & {
    readonly primaryImage: readonly ImageCandidate[]
  } & (K extends WorkType
      ? {
          readonly backdropImage: readonly ImageCandidate[]
          readonly titleLogo: readonly ImageCandidate[]
        }
      : object) &
    (K extends 'game' ? { readonly iconImage: readonly ImageCandidate[] } : object)
}

/**
 * Provided metadata fields for an entry kind, preserving omission separately from explicit empty
 * values.
 */
export type MetadataEntryFields<T extends EntryType> = Partial<MetadataEntryFieldValues[T]>

/** Metadata field name applicable to the selected entry kind. */
export type MetadataEntryField<T extends EntryType> = Extract<
  keyof MetadataEntryFieldValues[T],
  string
>

/** Metadata field value types for each part kind, using source candidates for images. */
export type MetadataPartFieldValues = {
  [K in PartType]: Omit<PartFields<K>, 'externalIdentities' | 'primaryImageId'> & {
    readonly primaryImage: readonly ImageCandidate[]
  }
}

/**
 * Provided metadata fields for a part kind, preserving omission separately from explicit empty
 * values.
 */
export type MetadataPartFields<T extends PartType> = Partial<MetadataPartFieldValues[T]>

/** Metadata field name applicable to the selected part kind. */
export type MetadataPartField<T extends PartType> = Extract<
  keyof MetadataPartFieldValues[T],
  string
>

/** Optional description and sensitivity metadata for a tag candidate. */
export interface MetadataTagFields {
  readonly description?: string | null
  readonly isNsfw?: boolean
}

/** Image uses supported as metadata fields by the selected entry kind. */
export type MetadataImageField<T extends EntryType> = Extract<
  MetadataEntryField<T>,
  'primaryImage' | 'backdropImage' | 'titleLogo' | 'iconImage'
>

/**
 * Concrete processable field identity tied to its entry, part, tag or relation kind.
 *
 * Relation membership and binding dimensions are outside the processable field vocabulary.
 */
export type MetadataFieldRef =
  | {
      [T in EntryType]: {
        [F in keyof MetadataEntryFieldValues[T]]: {
          readonly object: 'entry'
          readonly entryType: T
          readonly field: F
        }
      }[keyof MetadataEntryFieldValues[T]]
    }[EntryType]
  | {
      [T in PartType]: {
        [F in keyof MetadataPartFieldValues[T]]: {
          readonly object: 'part'
          readonly partType: T
          readonly field: F
        }
      }[keyof MetadataPartFieldValues[T]]
    }[PartType]
  | { readonly object: 'tag'; readonly field: 'description' | 'isNsfw' }
  | {
      [R in keyof MetadataRelationAttributeValues]: {
        [F in keyof MetadataRelationAttributeValues[R]]: {
          readonly object: 'relation'
          readonly relation: R
          readonly field: F
        }
      }[keyof MetadataRelationAttributeValues[R]]
    }[keyof MetadataRelationAttributeValues]

/** Concrete entry or part field whose value is an image-candidate collection. */
export type MetadataImageFieldRef = Extract<
  MetadataFieldRef,
  {
    readonly object: 'entry' | 'part'
    readonly field: 'primaryImage' | 'backdropImage' | 'titleLogo' | 'iconImage'
  }
>

/** Value type selected by a concrete metadata field reference. */
export type MetadataFieldValue<F extends MetadataFieldRef> = F extends {
  object: 'entry'
  entryType: infer T extends EntryType
  field: infer K
}
  ? K extends keyof MetadataEntryFieldValues[T]
    ? MetadataEntryFieldValues[T][K]
    : never
  : F extends { object: 'part'; partType: infer T extends PartType; field: infer K }
    ? K extends keyof MetadataPartFieldValues[T]
      ? MetadataPartFieldValues[T][K]
      : never
    : F extends { object: 'tag'; field: infer K }
      ? K extends keyof MetadataTagFields
        ? Exclude<MetadataTagFields[K], undefined>
        : never
      : F extends {
            object: 'relation'
            relation: infer R extends keyof MetadataRelationAttributeValues
            field: infer K
          }
        ? K extends keyof MetadataRelationAttributeValues[R]
          ? MetadataRelationAttributeValues[R][K]
          : never
        : never

/**
 * Original source names and aliases available as matching evidence.
 *
 * Evidence excludes processor output, null placeholders and invented defaults.
 */
interface NameIdentification {
  readonly name?: string
  readonly originalName?: string
  readonly aliases?: readonly string[]
}

/** Original names, dates and other comparable source facts applicable to an entry kind. */
export type IdentificationFields<T extends EntryType> = NameIdentification &
  (T extends WorkType
    ? {
        readonly releaseDate?: PartialDate
      } & (T extends 'anime' | 'comic' | 'novel'
        ? { readonly releaseEndDate?: PartialDate }
        : object)
    : T extends 'character'
      ? {
          readonly birthDate?: PartialDate
          readonly gender?: Gender
        }
      : T extends 'person'
        ? {
            readonly birthDate?: PartialDate
            readonly deathDate?: PartialDate
            readonly gender?: Gender
          }
        : {
            readonly foundedDate?: PartialDate
            readonly dissolvedDate?: PartialDate
          })

/** Original names, release date and kind-specific labels or classifications for matching a part. */
export type PartIdentificationFields<T extends PartType> = NameIdentification & {
  readonly releaseDate?: PartialDate
} & (T extends 'animeExtra'
    ? { readonly type?: AnimeExtraType }
    : { readonly numberLabel?: string }) &
  (T extends 'animeEpisode' ? { readonly type?: AnimeEpisodeType } : object)

/** Public clues for locating one source work by names, release date or external identities. */
export interface WorkClues {
  readonly name?: string
  readonly originalName?: string
  readonly releaseDate?: PartialDate
  readonly externalIdentities?: readonly ExternalIdentity[]
}

/** Public root-location clues restricted to the selected entry kind. */
export type IdentificationClues<T extends EntryType> = T extends WorkType
  ? WorkClues
  : {
      readonly name?: string
      readonly originalName?: string
      readonly externalIdentities?: readonly ExternalIdentity[]
    } & (T extends 'character' | 'person'
      ? { readonly birthDate?: PartialDate }
      : { readonly foundedDate?: PartialDate })

/** Source root with its complete opaque identity and original identification evidence. */
export type SourceEntry<T extends EntryType = EntryType> = {
  [K in EntryType]: {
    readonly type: K
    readonly identity: ExternalIdentity
    readonly identification: IdentificationFields<K>
    readonly externalIdentities?: readonly ExternalIdentity[]
  }
}[T]

const imageCandidateSchema = v.strictObject({
  image: v.pipe(v.unknown(), v.transform(parseFileInput)),
  thumbnail: v.exactOptional(v.pipe(v.unknown(), v.transform(parseFileInput))),
  identity: v.exactOptional(v.strictObject({ source: identitySchema.entries.source, id })),

  width: v.exactOptional(positiveInteger),
  height: v.exactOptional(positiveInteger),

  label: v.exactOptional(text),
  sourceCategory: v.exactOptional(nonemptyText),
  languages: v.exactOptional(
    v.pipe(
      v.array(languageSchema),
      v.transform((values) => [...new Set(values)]),
    ),
  ),
  credits: v.exactOptional(
    v.array(v.strictObject({ name: nonemptyText, url: v.exactOptional(nonemptyText) })),
  ),
})

const images = v.array(imageCandidateSchema)

export const metadataRelationAttributeEntries = {
  workCharacters: {
    role: v.nullable(v.picklist(characterRoles)),
    note: v.nullable(text),
    isSpoiler: v.boolean(),
  },
  personWorks: { note: v.nullable(text), isSpoiler: v.boolean() },
  organizationWorks: { note: v.nullable(text), isSpoiler: v.boolean() },
  workRelations: { note: v.nullable(text) },
  entryTags: { note: v.nullable(text), isSpoiler: v.boolean() },
  volumeChapters: { numberLabel: v.nullable(text) },
  workVolumes: {},
  workChapters: {},
  workEpisodes: {},
  workExtras: {},
} satisfies Record<keyof MetadataRelationMembers, v.ObjectEntries>

const commonFields = {
  name: entryCommonEntries.name,
  originalName: entryCommonEntries.originalName,
  aliases: entryCommonEntries.aliases,
  description: entryCommonEntries.description,
  primaryImage: images,
  externalLinks: entryCommonEntries.externalLinks,
  isNsfw: entryCommonEntries.isNsfw,
}

/**
 * Returns the metadata value schemas applicable to an entry kind.
 *
 * These schemas also own the field vocabulary used by read requests and profile validation.
 */
export function metadataEntryEntries(type: EntryType): v.ObjectEntries {
  const specific = Object.fromEntries(
    Object.entries(entrySpecificEntries[type]).filter(
      ([name]) => !['backdropImageId', 'titleLogoId', 'iconImageId'].includes(name),
    ),
  )
  return {
    ...commonFields,
    ...specific,
    ...(['game', 'anime', 'comic', 'novel'].includes(type)
      ? { backdropImage: images, titleLogo: images }
      : {}),
    ...(type === 'game' ? { iconImage: images } : {}),
  }
}

/** Returns a part kind's metadata schemas with image candidates in place of saved image IDs. */
export function metadataPartEntries(type: PartType): v.ObjectEntries {
  const common = omitFields(partCommonEntries, ['primaryImageId', 'externalIdentities'])
  return { ...common, ...partSpecificEntries[type], primaryImage: images }
}

/** Returns schemas for original matching evidence applicable to an entry kind. */
export function identificationEntries(type: EntryType): v.ObjectEntries {
  const common = { name: nonemptyText, originalName: nonemptyText, aliases: v.array(nonemptyText) }
  if (type === 'game') {
    return { ...common, releaseDate: partialDateSchema }
  }
  if (type === 'anime' || type === 'comic' || type === 'novel') {
    return { ...common, releaseDate: partialDateSchema, releaseEndDate: partialDateSchema }
  }
  if (type === 'character') {
    return { ...common, birthDate: partialDateSchema, gender: genderSchema }
  }
  if (type === 'person') {
    return {
      ...common,
      birthDate: partialDateSchema,
      deathDate: partialDateSchema,
      gender: genderSchema,
    }
  }

  return { ...common, foundedDate: partialDateSchema, dissolvedDate: partialDateSchema }
}

/** Returns schemas for original matching evidence applicable to a part kind. */
export function partIdentificationEntries(type: PartType): v.ObjectEntries {
  return {
    name: nonemptyText,
    originalName: nonemptyText,
    aliases: v.array(nonemptyText),
    releaseDate: partialDateSchema,
    ...(type === 'animeExtra'
      ? { type: v.picklist(['opening', 'ending', 'promotion', 'interview', 'other']) }
      : { numberLabel: nonemptyText }),
    ...(type === 'animeEpisode' ? { type: v.picklist(['regular', 'special']) } : {}),
  }
}

/**
 * Parses original and preview image references with their independent resource policies.
 *
 * Validation does not prepare resources or establish ownership.
 */
export function parseImageCandidate(input: unknown): ImageCandidate {
  return parseValue(imageCandidateSchema, input, 'Invalid metadata image candidate')
}

/**
 * Parses applicable entry metadata, preserving omission and legal explicit empty values.
 *
 * Local, private and inapplicable fields are rejected.
 */
export function parseMetadataEntryFields<T extends EntryType>(
  type: T,
  input: unknown,
): MetadataEntryFields<T> {
  return parseValue(
    v.strictObject(optionalFields(metadataEntryEntries(type))),
    input,
    'Invalid metadata entry fields',
  ) as MetadataEntryFields<T>
}

/**
 * Parses metadata fields for a part kind, including source classification where applicable.
 *
 * Part identity and ownership are outside these fields.
 */
export function parseMetadataPartFields<T extends PartType>(
  type: T,
  input: unknown,
): MetadataPartFields<T> {
  return parseValue(
    v.strictObject(optionalFields(metadataPartEntries(type))),
    input,
    'Invalid metadata part fields',
  ) as MetadataPartFields<T>
}

/** Parses original entry evidence from the fields supported by matching rules. */
export function parseIdentificationFields<T extends EntryType>(
  type: T,
  input: unknown,
): IdentificationFields<T> {
  return parseValue(
    v.strictObject(optionalFields(identificationEntries(type))),
    input,
    'Invalid original identification fields',
  ) as IdentificationFields<T>
}

/** Parses original matching evidence for the selected part kind. */
export function parsePartIdentificationFields<T extends PartType>(
  type: T,
  input: unknown,
): PartIdentificationFields<T> {
  return parseValue(
    v.strictObject(optionalFields(partIdentificationEntries(type))),
    input,
    'Invalid original part identification',
  ) as PartIdentificationFields<T>
}

/**
 * Parses permitted clues for locating a single source root.
 *
 * Empty clues are representable; the resolver reports insufficientInput when it cannot proceed.
 */
export function parseIdentificationClues<T extends EntryType>(
  type: T,
  input: unknown,
): IdentificationClues<T> {
  let dateField = 'releaseDate'
  if (type === 'character' || type === 'person') {
    dateField = 'birthDate'
  } else if (type === 'organization') {
    dateField = 'foundedDate'
  }
  return parseValue(
    v.strictObject(
      optionalFields({
        name: nonemptyText,
        originalName: nonemptyText,
        [dateField]: partialDateSchema,
        externalIdentities: identitiesSchema,
      }),
    ),
    input,
    'Invalid identification clues',
  ) as IdentificationClues<T>
}

/**
 * Parses a typed source root and requires additional identities to be distinct from its primary
 * identity.
 */
export function parseSourceEntry(input: unknown): SourceEntry {
  const { type } = parseValue(
    v.looseObject({ type: v.picklist(entryTypes) }),
    input,
    'Invalid source entry',
  )
  const value = parseValue(
    v.strictObject({
      type: v.literal(type),
      identity: identitySchema,
      identification: v.pipe(
        v.unknown(),
        v.transform((value) => parseIdentificationFields(type, value)),
      ),
      externalIdentities: v.exactOptional(identitiesSchema),
    }),
    input,
    'Invalid source entry',
  )
  if (
    value.externalIdentities?.some(
      (identity) => identityKey(identity) === identityKey(value.identity),
    )
  ) {
    throw new DesktopError(
      'InvalidInput',
      'Additional identities must exclude the primary identity',
    )
  }

  return value as SourceEntry
}

/** Creates a schema for distinct names selected from a declared field vocabulary. */
export function fieldNamesSchema(names: readonly string[]) {
  return v.pipe(
    v.array(v.picklist(names)),
    v.check((values) => unique(values, (value) => value)),
  )
}

/** Returns an entry kind's metadata field names from their owning value schemas. */
export function getMetadataEntryFields<T extends EntryType>(
  type: T,
): readonly MetadataEntryField<T>[] {
  return Object.keys(metadataEntryEntries(type)) as MetadataEntryField<T>[]
}

/** Returns a part kind's metadata field names from their owning value schemas. */
export function getMetadataPartFields<T extends PartType>(
  type: T,
): readonly MetadataPartField<T>[] {
  return Object.keys(metadataPartEntries(type)) as MetadataPartField<T>[]
}

/** Parses a concrete field identity and checks its applicability to the declared object kind. */
export function parseMetadataFieldRef(input: unknown): MetadataFieldRef {
  const header = parseValue(
    v.looseObject({ object: v.picklist(['entry', 'part', 'tag', 'relation']) }),
    input,
    'Invalid metadata field reference',
  )
  if (header.object === 'entry') {
    const value = parseValue(
      v.strictObject({
        object: v.literal('entry'),
        entryType: v.picklist(entryTypes),
        field: nonemptyText,
      }),
      input,
    )
    if (!Object.hasOwn(metadataEntryEntries(value.entryType), value.field)) {
      throw new DesktopError('InvalidInput', 'Metadata field is not applicable to this entry type')
    }

    return value as MetadataFieldRef
  }
  if (header.object === 'part') {
    const value = parseValue(
      v.strictObject({
        object: v.literal('part'),
        partType: v.picklist([
          'novelVolume',
          'comicVolume',
          'comicChapter',
          'animeEpisode',
          'animeExtra',
        ]),
        field: nonemptyText,
      }),
      input,
    )
    if (!Object.hasOwn(metadataPartEntries(value.partType), value.field)) {
      throw new DesktopError('InvalidInput', 'Metadata field is not applicable to this part type')
    }

    return value as MetadataFieldRef
  }
  if (header.object === 'tag') {
    return parseValue(
      v.strictObject({ object: v.literal('tag'), field: v.picklist(['description', 'isNsfw']) }),
      input,
    )
  }

  const value = parseValue(
    v.strictObject({
      object: v.literal('relation'),
      relation: v.picklist(
        Object.keys(metadataRelationFields) as (keyof MetadataRelationMembers)[],
      ),
      field: nonemptyText,
    }),
    input,
  )
  if (!Object.hasOwn(metadataRelationAttributeEntries[value.relation], value.field)) {
    throw new DesktopError(
      'InvalidInput',
      'A relation identity or membership is not a processable field',
    )
  }

  return value as MetadataFieldRef
}

/**
 * Parses a value using its concrete field's schema.
 *
 * Legal null, false, zero and complete empty collections retain their field-specific meanings.
 */
export function parseMetadataFieldValue<F extends MetadataFieldRef>(
  field: F,
  input: unknown,
): MetadataFieldValue<F> {
  const ref = parseMetadataFieldRef(field)
  let entries: v.ObjectEntries
  switch (ref.object) {
    case 'entry':
      entries = metadataEntryEntries(ref.entryType)
      break
    case 'part':
      entries = metadataPartEntries(ref.partType)
      break
    case 'tag':
      entries = { description: v.nullable(text), isNsfw: v.boolean() }
      break
    case 'relation':
      entries = metadataRelationAttributeEntries[ref.relation]
      break
  }

  const schema = entries[ref.field]!
  return parseValue(schema, input, 'Invalid metadata field value') as MetadataFieldValue<F>
}

/**
 * Parses an ordered selection of distinct provider or processor IDs.
 *
 * Live-reference availability is checked by the execution owner.
 */
export function parseMetadataImplementationIds(input: unknown): readonly string[] {
  return parseValue(
    v.pipe(
      v.array(id),
      v.check((ids) => unique(ids, (value) => value)),
    ),
    input,
    'Invalid metadata implementation IDs',
  )
}
