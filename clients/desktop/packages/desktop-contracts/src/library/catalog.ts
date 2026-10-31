/** @fileoverview Defines catalog fields, complete entry creation, and related-field edit baselines. */

import * as v from 'valibot'
import { objectSchema } from '../schema'
import { parseLanguageTag } from '@kisaki3/extension-distribution/metadata'
import { calendarDateSchema, partialDateSchema, type CalendarDate, type PartialDate } from '../date'
import { invalidInput } from '../errors'
import { preparedAttachmentSchema, type PreparedAttachment } from '../resources'
import {
  exactPartialEntries,
  hasRelatedExpected,
  hasUniqueKeys,
  nonemptyStringSchema,
  nonnegativeIntegerSchema,
  nonnegativeNumberSchema,
  parseContract,
  type FieldSchemas,
} from '../validation'
import {
  externalIdentityKey,
  externalIdentitySchema,
  type EntryRef,
  type EntryType,
  type ExternalIdentity,
  type WorkType,
} from './identity'

/** Personal current arrangement; a completion is a separate historical fact. */
export const workStatuses = ['planned', 'active', 'onHold'] as const
/** Known release state of serially released works, independent of personal status. */
export const releaseStatuses = ['planned', 'ongoing', 'finished', 'paused', 'cancelled'] as const
/** Explicit source/user classification. Null is unknown, not other or genderless. */
export const genders = ['male', 'female', 'nonBinary', 'genderless', 'other'] as const
export const bloodTypes = ['a', 'b', 'ab', 'o'] as const
export type WorkStatus = (typeof workStatuses)[number]
export type ReleaseStatus = (typeof releaseStatuses)[number]
export type Gender = (typeof genders)[number]
export type BloodType = (typeof bloodTypes)[number]

/** A measured single value or the complete source text; units belong to the containing field. */
export type CharacterMeasurement =
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'text'; readonly value: string }
/** A named ordinary reference link; it never creates an external identity binding. */
export interface ExternalLink {
  readonly name: string
  readonly url: string
}
/** Rating is an integer on the 0–100 personal scale; null remains distinct from zero. */
export interface Evaluation {
  readonly rating: number | null
  readonly favorite: boolean
}
/** Current work values, independent of activity rows, completion history, and file position. */
export interface WorkRecord {
  readonly status: WorkStatus | null
  readonly additionalDurationMs: number
}
/** Read-only summaries derive from actual facts and are never accepted by a catalog edit. */
export interface WorkSummary {
  readonly totalDurationMs: number
  readonly lastActiveAt: number | null
  readonly completionCount: number
  readonly firstCompletedDate: CalendarDate | null
  readonly lastCompletedDate: CalendarDate | null
}

export const ratingSchema = v.nullable(v.pipe(nonnegativeIntegerSchema, v.maxValue(100)))
export const evaluationEntries = { rating: ratingSchema, favorite: v.boolean() }
export const workRecordEntries = {
  status: v.nullable(v.picklist(workStatuses)),
  additionalDurationMs: nonnegativeIntegerSchema,
}
export const evaluationChangeSchema = objectSchema(exactPartialEntries(evaluationEntries))
export const workRecordChangeSchema = objectSchema(exactPartialEntries(workRecordEntries))
export const characterMeasurementSchema = v.union([
  objectSchema({ kind: v.literal('number'), value: nonnegativeNumberSchema }),
  objectSchema({ kind: v.literal('text'), value: nonemptyStringSchema }),
])
const nullableText = v.nullable(nonemptyStringSchema)
const nullableDate = v.nullable(partialDateSchema)
const nullableCount = v.nullable(nonnegativeIntegerSchema)
const languageSchema = v.pipe(
  v.string(),
  v.check((value) => {
    try {
      parseLanguageTag(value)
      return true
    } catch {
      return false
    }
  }),
  v.transform((value) => parseLanguageTag(value)),
)
export const externalLinkSchema = objectSchema({
  name: nonemptyStringSchema,
  url: v.pipe(v.string(), v.url()),
})
export const externalIdentitiesSchema = v.pipe(
  v.array(externalIdentitySchema),
  v.check((values) => hasUniqueKeys(values, externalIdentityKey)),
  v.readonly(),
)

/** Metadata fields shared by all entries. Write definitions are independent of database and read projections. */
export const commonEntryFields = {
  name: nonemptyStringSchema,
  originalName: nullableText,
  sortName: nullableText,
  aliases: v.pipe(v.array(nonemptyStringSchema), v.readonly()),
  description: v.nullable(v.string()),
  primaryImageId: nullableText,
  externalLinks: v.pipe(v.array(externalLinkSchema), v.readonly()),
  isNsfw: v.boolean(),
  addedDate: nullableDate,
  externalIdentities: externalIdentitiesSchema,
} satisfies FieldSchemas<CommonEntryMetadata>
export const commonWorkFields = {
  releaseDate: nullableDate,
  originalLanguages: v.pipe(
    v.array(languageSchema),
    v.check((values) => new Set(values).size === values.length),
    v.readonly(),
  ),
  backdropImageId: nullableText,
  titleLogoId: nullableText,
} satisfies FieldSchemas<WorkMetadata>
const serialFields = {
  releaseStatus: v.nullable(v.picklist(releaseStatuses)),
  releaseEndDate: nullableDate,
}
const characterFields = {
  birthDate: nullableDate,
  gender: v.nullable(v.picklist(genders)),
  bloodType: v.nullable(v.picklist(bloodTypes)),
  age: v.nullable(characterMeasurementSchema),
  height: v.nullable(characterMeasurementSchema),
  weight: v.nullable(characterMeasurementSchema),
  bust: v.nullable(characterMeasurementSchema),
  waist: v.nullable(characterMeasurementSchema),
  hips: v.nullable(characterMeasurementSchema),
  cupSize: nullableText,
}
export const entryMetadataFields = {
  game: { ...commonEntryFields, ...commonWorkFields, iconImageId: nullableText },
  anime: {
    ...commonEntryFields,
    ...commonWorkFields,
    ...serialFields,
    declaredDurationMs: nullableCount,
    declaredRegularEpisodeCount: nullableCount,
    declaredSpecialEpisodeCount: nullableCount,
  },
  comic: {
    ...commonEntryFields,
    ...commonWorkFields,
    ...serialFields,
    declaredPageCount: nullableCount,
    declaredVolumeCount: nullableCount,
    declaredChapterCount: nullableCount,
  },
  novel: {
    ...commonEntryFields,
    ...commonWorkFields,
    ...serialFields,
    declaredPageCount: nullableCount,
    declaredVolumeCount: nullableCount,
  },
  character: { ...commonEntryFields, ...characterFields },
  person: {
    ...commonEntryFields,
    birthDate: nullableDate,
    deathDate: nullableDate,
    gender: v.nullable(v.picklist(genders)),
  },
  organization: { ...commonEntryFields, foundedDate: nullableDate, dissolvedDate: nullableDate },
} satisfies { [Type in EntryType]: FieldSchemas<EntryMetadataByType[Type]> }

/** Explicit catalog metadata, separate from generated identity, timestamps, and personal records. */
export interface CommonEntryMetadata {
  readonly name: string
  readonly originalName: string | null
  readonly sortName: string | null
  readonly aliases: readonly string[]
  readonly description: string | null
  readonly primaryImageId: string | null
  readonly externalLinks: readonly ExternalLink[]
  readonly isNsfw: boolean
  readonly addedDate: PartialDate | null
  readonly externalIdentities: readonly ExternalIdentity[]
}

/** Source facts shared by four works, without creating a separate work identity. */
export interface WorkMetadata {
  readonly releaseDate: PartialDate | null
  readonly originalLanguages: readonly string[]
  readonly backdropImageId: string | null
  readonly titleLogoId: string | null
}
interface SerialMetadata {
  readonly releaseStatus: ReleaseStatus | null
  readonly releaseEndDate: PartialDate | null
}
/** The seven explicit catalog field families. Public declarations contain values, not validator internals. */
export interface EntryMetadataByType {
  readonly game: CommonEntryMetadata & WorkMetadata & { readonly iconImageId: string | null }
  readonly anime: CommonEntryMetadata &
    WorkMetadata &
    SerialMetadata & {
      readonly declaredDurationMs: number | null
      readonly declaredRegularEpisodeCount: number | null
      readonly declaredSpecialEpisodeCount: number | null
    }
  readonly comic: CommonEntryMetadata &
    WorkMetadata &
    SerialMetadata & {
      readonly declaredPageCount: number | null
      readonly declaredVolumeCount: number | null
      readonly declaredChapterCount: number | null
    }
  readonly novel: CommonEntryMetadata &
    WorkMetadata &
    SerialMetadata & {
      readonly declaredPageCount: number | null
      readonly declaredVolumeCount: number | null
    }
  readonly character: CommonEntryMetadata & {
    readonly birthDate: PartialDate | null
    readonly gender: Gender | null
    readonly bloodType: BloodType | null
    readonly age: CharacterMeasurement | null
    readonly height: CharacterMeasurement | null
    readonly weight: CharacterMeasurement | null
    readonly bust: CharacterMeasurement | null
    readonly waist: CharacterMeasurement | null
    readonly hips: CharacterMeasurement | null
    readonly cupSize: string | null
  }
  readonly person: CommonEntryMetadata & {
    readonly birthDate: PartialDate | null
    readonly deathDate: PartialDate | null
    readonly gender: Gender | null
  }
  readonly organization: CommonEntryMetadata & {
    readonly foundedDate: PartialDate | null
    readonly dissolvedDate: PartialDate | null
  }
}
/** A bounded detail snapshot. Full Markdown and unbounded relations/history have separate reads. */
export type EntryDetails<Type extends EntryType = EntryType> = {
  [Kind in Type]: Readonly<
    Omit<EntryMetadataByType[Kind], 'description'> & {
      id: string
      type: Kind
      createdAt: number
      updatedAt: number
      evaluation: Evaluation
    } & (Kind extends WorkType ? { record: WorkRecord; summary: WorkSummary } : object)
  >
}[Type]

export const tagMemberSchema = objectSchema({
  tagId: nonemptyStringSchema,
  note: v.nullable(v.string()),
  isSpoiler: v.boolean(),
})
export const collectionMemberSchema = objectSchema({
  collectionId: nonemptyStringSchema,
  note: v.nullable(v.string()),
})
const initialTagSchema = objectSchema({
  tagId: nonemptyStringSchema,
  note: v.exactOptional(v.nullable(v.string())),
  isSpoiler: v.exactOptional(v.boolean()),
})
const initialCollectionSchema = objectSchema({
  collectionId: nonemptyStringSchema,
  note: v.exactOptional(v.nullable(v.string())),
})
const initialCompletionSchema = objectSchema({
  completedDate: v.nullable(calendarDateSchema),
  note: v.nullable(v.string()),
})
const uniqueTags = v.pipe(
  v.array(tagMemberSchema),
  v.check((values) => hasUniqueKeys(values, (value) => value.tagId)),
  v.readonly(),
)
const uniqueCollections = v.pipe(
  v.array(collectionMemberSchema),
  v.check((values) => hasUniqueKeys(values, (value) => value.collectionId)),
  v.readonly(),
)

/** Complete saved tag membership on the entry side, including this side's order. */
export interface EntryTag {
  readonly tagId: string
  readonly note: string | null
  readonly isSpoiler: boolean
}
/** Complete saved manual-collection membership. Array order does not change global collection order. */
export interface EntryCollection {
  readonly collectionId: string
  readonly note: string | null
}

export const entryTagChangeSchema = v.union([
  objectSchema({ type: v.literal('replace'), items: uniqueTags }),
  v.pipe(
    objectSchema({
      type: v.literal('modify'),
      add: v.exactOptional(uniqueTags),
      remove: v.exactOptional(v.array(nonemptyStringSchema)),
    }),
    v.check((value) =>
      validMembershipModification(
        value.add?.map((item) => item.tagId),
        value.remove,
      ),
    ),
  ),
])
export const entryCollectionChangeSchema = v.union([
  objectSchema({ type: v.literal('replace'), items: uniqueCollections }),
  v.pipe(
    objectSchema({
      type: v.literal('modify'),
      add: v.exactOptional(uniqueCollections),
      remove: v.exactOptional(v.array(nonemptyStringSchema)),
    }),
    v.check((value) =>
      validMembershipModification(
        value.add?.map((item) => item.collectionId),
        value.remove,
      ),
    ),
  ),
])

/** Explicit whole-side replacement or idempotent add/remove intent; existing properties are retained on add. */
export type EntryTagChange =
  | { readonly type: 'replace'; readonly items: readonly EntryTag[] }
  | {
      readonly type: 'modify'
      readonly add?: readonly EntryTag[]
      readonly remove?: readonly string[]
    }
export type EntryCollectionChange =
  | { readonly type: 'replace'; readonly items: readonly EntryCollection[] }
  | {
      readonly type: 'modify'
      readonly add?: readonly EntryCollection[]
      readonly remove?: readonly string[]
    }

export const initialEntries = {
  evaluation: v.exactOptional(evaluationChangeSchema),
  tags: v.exactOptional(
    v.pipe(
      v.array(initialTagSchema),
      v.check((values) => hasUniqueKeys(values, (value) => value.tagId)),
      v.readonly(),
    ),
  ),
  collections: v.exactOptional(
    v.pipe(
      v.array(initialCollectionSchema),
      v.check((values) => hasUniqueKeys(values, (value) => value.collectionId)),
      v.readonly(),
    ),
  ),
  prepared: v.exactOptional(v.pipe(v.array(preparedAttachmentSchema), v.readonly())),
}
export const workInitialEntries = {
  record: v.exactOptional(workRecordChangeSchema),
  completionRecords: v.exactOptional(v.pipe(v.array(initialCompletionSchema), v.readonly())),
}
const entryCreateSchemas = {
  game: objectSchema({
    type: v.literal('game'),
    ...exactPartialEntries(entryMetadataFields.game),
    name: nonemptyStringSchema,
    ...initialEntries,
    ...workInitialEntries,
  }),
  anime: objectSchema({
    type: v.literal('anime'),
    ...exactPartialEntries(entryMetadataFields.anime),
    name: nonemptyStringSchema,
    ...initialEntries,
    ...workInitialEntries,
  }),
  comic: objectSchema({
    type: v.literal('comic'),
    ...exactPartialEntries(entryMetadataFields.comic),
    name: nonemptyStringSchema,
    ...initialEntries,
    ...workInitialEntries,
  }),
  novel: objectSchema({
    type: v.literal('novel'),
    ...exactPartialEntries(entryMetadataFields.novel),
    name: nonemptyStringSchema,
    ...initialEntries,
    ...workInitialEntries,
  }),
  character: objectSchema({
    type: v.literal('character'),
    ...exactPartialEntries(entryMetadataFields.character),
    name: nonemptyStringSchema,
    ...initialEntries,
  }),
  person: objectSchema({
    type: v.literal('person'),
    ...exactPartialEntries(entryMetadataFields.person),
    name: nonemptyStringSchema,
    ...initialEntries,
  }),
  organization: objectSchema({
    type: v.literal('organization'),
    ...exactPartialEntries(entryMetadataFields.organization),
    name: nonemptyStringSchema,
    ...initialEntries,
  }),
}

/** Initial data for one complete entry, with only the personal values applicable to its kind. */
export type EntryCreateInput<Type extends EntryType = EntryType> = {
  [Kind in Type]: {
    readonly type: Kind
    readonly name: string
    readonly evaluation?: Partial<Evaluation>
    readonly tags?: readonly {
      readonly tagId: string
      readonly note?: string | null
      readonly isSpoiler?: boolean
    }[]
    readonly collections?: readonly {
      readonly collectionId: string
      readonly note?: string | null
    }[]
    readonly prepared?: readonly PreparedAttachment[]
  } & Partial<Omit<EntryMetadataByType[Kind], 'name'>> &
    (Kind extends WorkType
      ? {
          readonly record?: Partial<WorkRecord>
          readonly completionRecords?: readonly {
            readonly completedDate: CalendarDate | null
            readonly note: string | null
          }[]
        }
      : object)
}[Type]

export const entryUpdateSchemas: {
  [Type in EntryType]: v.GenericSchema<unknown, EntryUpdateInput<Type>>
} = {
  game: entryUpdateSchema({ ...entryMetadataFields.game, record: workRecordChangeSchema }),
  anime: entryUpdateSchema({ ...entryMetadataFields.anime, record: workRecordChangeSchema }),
  comic: entryUpdateSchema({ ...entryMetadataFields.comic, record: workRecordChangeSchema }),
  novel: entryUpdateSchema({ ...entryMetadataFields.novel, record: workRecordChangeSchema }),
  character: entryUpdateSchema(entryMetadataFields.character),
  person: entryUpdateSchema(entryMetadataFields.person),
  organization: entryUpdateSchema(entryMetadataFields.organization),
}

/** An edit compares only modified independent fields and the contract's actual grouped baselines. */
export type EntryUpdateInput<Type extends EntryType = EntryType> = {
  [Kind in Type]: {
    readonly changes: Partial<EntryMetadataByType[Kind]> & {
      readonly evaluation?: Partial<Evaluation>
      readonly tags?: EntryTagChange
      readonly collections?: EntryCollectionChange
    } & (Kind extends WorkType ? { readonly record?: Partial<WorkRecord> } : object)
    readonly expected?: Partial<EntryMetadataByType[Kind]> & {
      readonly evaluation?: Partial<Evaluation>
      readonly tags?: readonly EntryTag[]
      readonly collections?: readonly EntryCollection[]
    } & (Kind extends WorkType ? { readonly record?: Partial<WorkRecord> } : object)
    readonly prepared?: readonly PreparedAttachment[]
  }
}[Type]
/** One short atomic batch item, preserving the reference-to-input kind relationship. */
export type EntryUpdate = {
  [Type in EntryType]: { readonly ref: EntryRef<Type> } & EntryUpdateInput<Type>
}[EntryType]

/** Parse a complete creation without inventing timestamps, IDs, current status, or history. */
export function parseEntryCreate(input: unknown): EntryCreateInput {
  return parseContract(v.union(Object.values(entryCreateSchemas)), input, 'entry creation')
}

/** Parse the update for its actual target kind, including nested expected-field restrictions. */
export function parseEntryUpdate<Type extends EntryType>(
  type: Type,
  input: unknown,
): EntryUpdateInput<Type> {
  return parseContract(entryUpdateSchemas[type], input, 'entry update')
}

/** Parse a personal evaluation edit; zero and null remain distinct and unrelated baselines fail. */
export function parseEvaluationUpdate(input: unknown): {
  readonly changes: Partial<Evaluation>
  readonly expected?: Partial<Evaluation>
} {
  return parseContract(
    v.pipe(
      objectSchema({
        changes: evaluationChangeSchema,
        expected: v.exactOptional(evaluationChangeSchema),
      }),
      v.check((value) => hasRelatedExpected(value.changes, value.expected)),
    ),
    input,
    'evaluation update',
  )
}

/** Read aliases independently, preserving valid items and order without rewriting malformed storage. */
export function readAliases(input: unknown): readonly string[] {
  return Array.isArray(input)
    ? input.filter((value): value is string => v.is(nonemptyStringSchema, value))
    : []
}

/** Read ordinary links independently; these forgiving semantics never apply to external identities. */
export function readExternalLinks(input: unknown): readonly ExternalLink[] {
  if (!Array.isArray(input)) {
    return []
  }
  return input.flatMap((item: unknown) => {
    const parsed = v.safeParse(externalLinkSchema, item)
    return parsed.success ? [parsed.output] : []
  })
}

/** Reject ambiguous add/remove intent before the operation checks actual endpoint existence. */
export function validMembershipModification(
  add: readonly string[] | undefined,
  remove: readonly string[] | undefined,
): boolean {
  return (
    ((add?.length ?? 0) > 0 || (remove?.length ?? 0) > 0) &&
    new Set(add).size === (add?.length ?? 0) &&
    new Set(remove).size === (remove?.length ?? 0) &&
    !(add ?? []).some((id) => remove?.includes(id))
  )
}

function entryUpdateSchema<Entries extends v.ObjectEntries>(entries: Entries) {
  const changes = objectSchema(
    exactPartialEntries({
      ...entries,
      evaluation: evaluationChangeSchema,
      tags: entryTagChangeSchema,
      collections: entryCollectionChangeSchema,
    }),
  )
  const expected = objectSchema(
    exactPartialEntries({
      ...entries,
      evaluation: evaluationChangeSchema,
      tags: uniqueTags,
      collections: uniqueCollections,
    }),
  )
  return v.pipe(
    objectSchema({
      changes,
      expected: v.exactOptional(expected),
      prepared: v.exactOptional(v.pipe(v.array(preparedAttachmentSchema), v.readonly())),
    }),
    v.check((value) => {
      if (value.changes === undefined || !hasRelatedExpected(value.changes, value.expected)) {
        return false
      }
      for (const key of ['evaluation', 'record']) {
        const baseline = value.expected?.[key]
        const change = value.changes[key]
        if (
          baseline &&
          typeof baseline === 'object' &&
          (!change || typeof change !== 'object' || !hasRelatedExpected(change, baseline))
        ) {
          return false
        }
      }
      for (const key of ['tags', 'collections'] as const) {
        if (value.expected?.[key] !== undefined && value.changes[key]?.type !== 'replace') {
          return false
        }
      }
      return true
    }),
  )
}

/** Require a pure finite measurement without extracting a number from a source's text. */
export function parseCharacterMeasurement(input: unknown): CharacterMeasurement {
  return parseContract(characterMeasurementSchema, input, 'character measurement')
}

/** Use the canonical error for an unavailable kind instead of treating it as a generic entry. */
export function requireEntryType(value: string): EntryType {
  if (Object.hasOwn(entryMetadataFields, value)) {
    return value as EntryType
  }
  return invalidInput('Invalid entry type.')
}
