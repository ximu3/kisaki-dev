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

/** An optional source-scoped image identity does not bind an Entry or Part in the catalog. */
export interface ImageIdentity {
  readonly source: string
  readonly id: string
}

/** Original and optional preview retain their own redirect policy. Claimed dimensions are display hints until decoding. */
export interface ImageCandidate {
  readonly image: FileInput
  readonly thumbnail?: FileInput
  readonly identity?: ImageIdentity

  readonly width?: number
  readonly height?: number

  readonly label?: string
  readonly sourceCategory?: string
  /** Omission is unknown; [] means the source explicitly identifies the image as language-neutral. */
  readonly languages?: readonly string[]
  /** Source uploader/provider credits, never catalog people or a claim of original rights ownership. */
  readonly credits?: readonly { readonly name: string; readonly url?: string }[]
}

type CatalogImageFields = 'primaryImageId' | 'backdropImageId' | 'titleLogoId' | 'iconImageId'

/** Field values reuse their actual catalog semantics, replacing saved image IDs with unadopted image candidates. */
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

export type MetadataEntryFields<T extends EntryType> = Partial<MetadataEntryFieldValues[T]>

export type MetadataEntryField<T extends EntryType> = Extract<
  keyof MetadataEntryFieldValues[T],
  string
>

export type MetadataPartFieldValues = {
  [K in PartType]: Omit<PartFields<K>, 'externalIdentities' | 'primaryImageId'> & {
    readonly primaryImage: readonly ImageCandidate[]
  }
}

export type MetadataPartFields<T extends PartType> = Partial<MetadataPartFieldValues[T]>

export type MetadataPartField<T extends PartType> = Extract<
  keyof MetadataPartFieldValues[T],
  string
>

export interface MetadataTagFields {
  readonly description?: string | null
  readonly isNsfw?: boolean
}

export type MetadataImageField<T extends EntryType> = Extract<
  MetadataEntryField<T>,
  'primaryImage' | 'backdropImage' | 'titleLogo' | 'iconImage'
>

/** A field identity retains its object's actual kind; there are no arbitrary paths or writeable relationship dimensions. */
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

export type MetadataImageFieldRef = Extract<
  MetadataFieldRef,
  {
    readonly object: 'entry' | 'part'
    readonly field: 'primaryImage' | 'backdropImage' | 'titleLogo' | 'iconImage'
  }
>

/** The concrete selected field determines the allowed processor/input value, rather than a parallel unconstrained union. */
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

/** Original useful identification facts never contain processor output, null placeholders or invented default dates. */
interface NameIdentification {
  readonly name?: string
  readonly originalName?: string
  readonly aliases?: readonly string[]
}

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

export type PartIdentificationFields<T extends PartType> = NameIdentification & {
  readonly releaseDate?: PartialDate
} & (T extends 'animeExtra'
    ? { readonly type?: AnimeExtraType }
    : { readonly numberLabel?: string }) &
  (T extends 'animeEpisode' ? { readonly type?: AnimeEpisodeType } : object)

/** Public location clues describe one entry; rich matching fields stay in original source identification. */
export interface WorkClues {
  readonly name?: string
  readonly originalName?: string
  readonly releaseDate?: PartialDate
  readonly externalIdentities?: readonly ExternalIdentity[]
}

export type IdentificationClues<T extends EntryType> = T extends WorkType
  ? WorkClues
  : {
      readonly name?: string
      readonly originalName?: string
      readonly externalIdentities?: readonly ExternalIdentity[]
    } & (T extends 'character' | 'person'
      ? { readonly birthDate?: PartialDate }
      : { readonly foundedDate?: PartialDate })

/** An actual source root with its complete opaque identity, not a local reference or a search display decoration. */
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

/** Internal schema fields are also the finite directory used by requests and profile validation. */
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

export function metadataPartEntries(type: PartType): v.ObjectEntries {
  const common = omitFields(partCommonEntries, ['primaryImageId', 'externalIdentities'])
  return { ...common, ...partSpecificEntries[type], primaryImage: images }
}

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

/** Validate the original image source and any preview separately; no preparation or ownership claim is performed. */
export function parseImageCandidate(input: unknown): ImageCandidate {
  return parseValue(imageCandidateSchema, input, 'Invalid metadata image candidate')
}

/** Reject local/private fields and inapplicable fields, while retaining omission and every legal explicit empty value. */
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

/** A part's source classification is ordinary metadata; kind identity and ownership are outside its fields. */
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

/** Original identification is bounded to fields that can meaningfully participate in the declared matching rules. */
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

/** Identify a single root using only its permitted clues. Empty clues are representable; the resolver reports insufficientInput. */
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

/** Validate a source root with exact primary and distinct additional identities. Type is never inferred from sourceId text. */
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

/** The finite field names come from their actual value schemas, retaining one owner for type applicability. */
export function getMetadataEntryFields<T extends EntryType>(
  type: T,
): readonly MetadataEntryField<T>[] {
  return Object.keys(metadataEntryEntries(type)) as MetadataEntryField<T>[]
}

export function getMetadataPartFields<T extends PartType>(
  type: T,
): readonly MetadataPartField<T>[] {
  return Object.keys(metadataPartEntries(type)) as MetadataPartField<T>[]
}

/** Validate a concrete field identity before interpreting its value or granting processor access to it. */
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

/** Parse a value according to its concrete public field, preserving null, false, zero and complete empty collections. */
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

/** Validate an explicit ordered selection of providers or processors without making unknown live references disappear. */
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
