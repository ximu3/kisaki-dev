/** @fileoverview Owns the seven entry identities, five real part identities and their editable catalog values. */

import type { PartialDate, CalendarDate } from '../date'
import type { PreparedAttachment } from '../resources'
import * as v from 'valibot'
import {
  id,
  nonemptyText,
  parseExternalValue,
  unique,
  nonnegativeNumber,
  rating,
  nonnegativeInteger,
  text,
  optionalFields,
  parseValue,
  validateExpectedKeys,
} from '../validation'
import { parsePartialDate, parseCalendarDate } from '../date'
import { normalizeLocale } from '@kisaki3/extension-distribution/metadata'
import { parsePreparedAttachment } from '../resources'
import { DesktopError } from '../errors'
import type { NonEmptyArray } from '../operations'

/** Actual independently cataloged kinds. Work is a subset, not another identity layer. */
export const entryTypes = Object.freeze([
  'game',
  'anime',
  'comic',
  'novel',
  'character',
  'person',
  'organization',
] as const)

export const workTypes = Object.freeze(['game', 'anime', 'comic', 'novel'] as const)

export const partTypes = Object.freeze([
  'novelVolume',
  'comicVolume',
  'comicChapter',
  'animeEpisode',
  'animeExtra',
] as const)

/** Entry kinds share stable IDs; implementation still verifies the real type for every supplied reference. */
export type EntryType = (typeof entryTypes)[number]

export type WorkType = (typeof workTypes)[number]

export type PartType = (typeof partTypes)[number]

/** A type-qualified catalog identity. The type never grants access to an otherwise hidden object. */
export interface EntryRef<T extends EntryType = EntryType> {
  readonly type: T
  readonly id: string
}

export type WorkRef<T extends WorkType = WorkType> = EntryRef<T>

/** Part identities are scoped by kind, with actual ownership supplied or read separately. */
export interface PartRef<T extends PartType = PartType> {
  readonly type: T
  readonly id: string
}

/** Each real part belongs to exactly one work of the corresponding medium. */
export type PartWorkType<T extends PartType> = T extends 'novelVolume'
  ? 'novel'
  : T extends 'comicVolume' | 'comicChapter'
    ? 'comic'
    : 'anime'

/** Exact source identity; sourceId is opaque and may include native kind and parent scope. */
export interface ExternalIdentity {
  readonly source: string
  readonly sourceId: string
}

/** An ordinary named page link, never evidence of an external identity or authority to fetch content. */
export interface ExternalLink {
  readonly name: string
  readonly url: string
}

/** A canonical language identifier, not a closed list of official UI languages. */
export type LanguageTag = string

/** Adopted explicit classifications; null in the owning field means unknown. */
export type Gender = 'male' | 'female' | 'nonBinary' | 'genderless' | 'other'

export type BloodType = 'a' | 'b' | 'ab' | 'o'

export type WorkStatus = 'planned' | 'active' | 'onHold'

export type ReleaseStatus = 'planned' | 'ongoing' | 'finished' | 'paused' | 'cancelled'

export type AnimeEpisodeType = 'regular' | 'special'

export type AnimeExtraType = 'opening' | 'ending' | 'promotion' | 'interview' | 'other'

/** A definite nonnegative quantity or the full nonempty source wording; no inferred units or range truncation. */
export type CharacterMeasure =
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'text'; readonly value: string }

/** Common editable facts; body and dates are whole replacement values, with null explicitly clearing a value. */
export interface EntryCommonFields {
  readonly name: string
  readonly originalName: string | null
  readonly sortName: string | null
  readonly aliases: readonly string[]

  readonly description: string | null
  readonly primaryImageId: string | null

  readonly externalLinks: readonly ExternalLink[]
  readonly externalIdentities: readonly ExternalIdentity[]

  readonly isNsfw: boolean
  readonly addedDate: PartialDate | null
}

/** Shared work facts; originalLanguages is original creative language, not subtitles or the UI locale. */
export interface WorkFields {
  readonly releaseDate: PartialDate | null
  readonly originalLanguages: readonly LanguageTag[]

  readonly backdropImageId: string | null
  readonly titleLogoId: string | null
}

/** Serial publication facts remain independent of personal status, completion history and local content. */
export interface SerialWorkFields {
  readonly releaseStatus: ReleaseStatus | null
  readonly releaseEndDate: PartialDate | null
}

/** Explicit current character facts. Numerical age is years, height/circumferences cm, weight kg. */
export interface CharacterFields {
  readonly birthDate: PartialDate | null
  readonly gender: Gender | null
  readonly bloodType: BloodType | null

  readonly age: CharacterMeasure | null
  readonly height: CharacterMeasure | null
  readonly weight: CharacterMeasure | null
  readonly bust: CharacterMeasure | null
  readonly waist: CharacterMeasure | null
  readonly hips: CharacterMeasure | null
  readonly cupSize: string | null
}

/** Explicit per-kind field ownership. Declared counts and duration are nullable nonnegative safe integers. */
export interface EntrySpecificFields {
  readonly game: WorkFields & { readonly iconImageId: string | null }

  readonly anime: WorkFields &
    SerialWorkFields & {
      readonly declaredDurationMs: number | null
      readonly declaredRegularEpisodeCount: number | null
      readonly declaredSpecialEpisodeCount: number | null
    }

  readonly comic: WorkFields &
    SerialWorkFields & {
      readonly declaredPageCount: number | null
      readonly declaredVolumeCount: number | null
      readonly declaredChapterCount: number | null
    }

  readonly novel: WorkFields &
    SerialWorkFields & {
      readonly declaredPageCount: number | null
      readonly declaredVolumeCount: number | null
    }

  readonly character: CharacterFields
  readonly person: {
    readonly birthDate: PartialDate | null
    readonly deathDate: PartialDate | null
    readonly gender: Gender | null
  }

  readonly organization: {
    readonly foundedDate: PartialDate | null
    readonly dissolvedDate: PartialDate | null
  }
}

/** An entry's editable catalog facts, without technical timestamps, derived summaries or private values. */
export type EntryFields<T extends EntryType> = EntryCommonFields & EntrySpecificFields[T]

/** Personal rating is an integer from 0 to 100, or null; missing rows read as null and false. */
export interface Evaluation {
  readonly rating: number | null
  readonly favorite: boolean
}

/** Current work arrangement and an absolute nonnegative millisecond amount with no fabricated activity date. */
export interface WorkRecord {
  readonly status: WorkStatus | null
  readonly additionalDurationMs: number
}

/** One initial completion fact, including a fact whose date and note are both unknown. */
export interface CompletionFields {
  readonly completedDate: CalendarDate | null
  readonly note: string | null
}

/** A saved tag association includes its attributes; array order belongs to this entry side. */
export interface EntryTag {
  readonly tagId: string
  readonly note: string | null
  readonly isSpoiler: boolean
}

/** Entry-side collection membership has no separate ordering; display follows global collection order. */
export interface EntryCollection {
  readonly collectionId: string
  readonly note: string | null
}

/** New associations default note to null and isSpoiler to false; existing associations retain their attributes. */
export interface EntryTagInput {
  readonly tagId: string
  readonly note?: string | null
  readonly isSpoiler?: boolean
}

export interface EntryCollectionInput {
  readonly collectionId: string
  readonly note?: string | null
}

/** Replacement covers the complete entry side; incremental changes cannot compare a whole-set baseline. */
export type EntryTagChange =
  | { readonly type: 'replace'; readonly items: readonly EntryTagInput[] }
  | {
      readonly type: 'modify'
      readonly add?: readonly EntryTagInput[]
      readonly remove?: readonly string[]
    }

export type EntryCollectionChange =
  | { readonly type: 'replace'; readonly items: readonly EntryCollectionInput[] }
  | {
      readonly type: 'modify'
      readonly add?: readonly EntryCollectionInput[]
      readonly remove?: readonly string[]
    }

/** Explicit editable fields, not a partial persisted row. Omission preserves; null clears only nullable facts. */
export type EntryChanges<T extends EntryType> = Partial<EntryFields<T>> & {
  readonly evaluation?: Partial<Evaluation>
  readonly tags?: EntryTagChange
  readonly collections?: EntryCollectionChange
} & (T extends WorkType ? { readonly record?: Partial<WorkRecord> } : { readonly record?: never })

/** Only changed independent fields may be compared; formal collections include hidden associations too. */
export type EntryExpected<T extends EntryType> = Partial<EntryFields<T>> & {
  readonly evaluation?: Partial<Evaluation>
  readonly tags?: readonly EntryTag[]
  readonly collections?: readonly EntryCollection[]
} & (T extends WorkType ? { readonly record?: Partial<WorkRecord> } : { readonly record?: never })

/** Each branch relates the real entry type to its catalog and personal fields. Name is required at creation. */
export type EntryCreateInput<T extends EntryType = EntryType> = {
  [K in T]: { readonly type: K; readonly name: string } & Partial<Omit<EntryFields<K>, 'name'>> & {
      readonly evaluation?: Partial<Evaluation>
      readonly tags?: readonly EntryTagInput[]
      readonly collections?: readonly EntryCollectionInput[]
      readonly prepared?: readonly PreparedAttachment[]
    } & (K extends WorkType
      ? {
          readonly record?: Partial<WorkRecord>
          readonly completionRecords?: readonly CompletionFields[]
        }
      : object)
}[T]

/** A short atomic edit; the ref supplies the type, and prepared holds never expand the saved field set. */
export type EntryUpdate<T extends EntryType = EntryType> = {
  [K in T]: {
    readonly ref: EntryRef<K>
    readonly changes: EntryChanges<K>
    readonly expected?: EntryExpected<K>
    readonly prepared?: readonly PreparedAttachment[]
  }
}[T]

/** Entry details leave long body and complete relations to their dedicated reads. Summaries are never writable. */
export type EntryDetails<T extends EntryType = EntryType> = {
  [K in T]: Omit<EntryFields<K>, 'description'> & {
    readonly id: string
    readonly type: K
    /** UTC milliseconds since the Unix epoch. */
    readonly createdAt: number
    /** UTC milliseconds since the Unix epoch. */
    readonly updatedAt: number
    readonly evaluation: Evaluation
  } & (K extends WorkType
      ? {
          readonly record: WorkRecord
          readonly totalDurationMs: number
          /** UTC milliseconds since the Unix epoch. */
          readonly lastActiveAt: number | null
          readonly completionCount: number
          readonly firstCompletedDate: CalendarDate | null
          readonly lastCompletedDate: CalendarDate | null
        }
      : object)
}[T]

export const entryRefSchema = v.strictObject({ type: v.picklist(entryTypes), id })

export const workRefSchema = v.strictObject({ type: v.picklist(workTypes), id })

export const partRefSchema = v.strictObject({ type: v.picklist(partTypes), id })

export const partialDateSchema = v.pipe(v.unknown(), v.transform(parsePartialDate))

export const calendarDateSchema = v.pipe(v.unknown(), v.transform(parseCalendarDate))

export const languageSchema = v.pipe(
  nonemptyText,
  v.transform((value) => parseExternalValue(normalizeLocale, value, 'Invalid language tag')),
)

export const identitySchema = v.strictObject({
  source: v.pipe(nonemptyText, v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)),
  sourceId: nonemptyText,
})

export const identitiesSchema = v.pipe(
  v.array(identitySchema),
  v.check((items) => unique(items, identityKey)),
)

export const externalLinkSchema = v.strictObject({ name: nonemptyText, url: nonemptyText })

export const genderSchema = v.picklist(['male', 'female', 'nonBinary', 'genderless', 'other'])

export const statusSchema = v.picklist(['planned', 'active', 'onHold'])

export const releaseStatusSchema = v.picklist([
  'planned',
  'ongoing',
  'finished',
  'paused',
  'cancelled',
])

export const measureSchema = v.variant('kind', [
  v.strictObject({ kind: v.literal('number'), value: nonnegativeNumber }),
  v.strictObject({ kind: v.literal('text'), value: nonemptyText }),
])

export const evaluationEntries = { rating: v.nullable(rating), favorite: v.boolean() }

export const recordEntries = {
  status: v.nullable(statusSchema),
  additionalDurationMs: nonnegativeInteger,
}

export const completionFieldsSchema = v.strictObject({
  completedDate: v.nullable(calendarDateSchema),
  note: v.pipe(
    v.nullable(text),
    v.transform((value) => (value === null || value.trim().length === 0 ? null : value)),
  ),
})

export const entryTagEntries = { tagId: id, note: v.nullable(text), isSpoiler: v.boolean() }

export const entryCollectionEntries = { collectionId: id, note: v.nullable(text) }

export const entryTagInputSchema = v.strictObject({
  tagId: id,
  ...optionalFields({ note: v.nullable(text), isSpoiler: v.boolean() }),
})

export const entryCollectionInputSchema = v.strictObject({
  collectionId: id,
  note: v.exactOptional(v.nullable(text)),
})

export const entryTagsSchema = v.pipe(
  v.array(v.strictObject(entryTagEntries)),
  v.check((items) => unique(items, (item) => item.tagId)),
)

export const entryCollectionsSchema = v.pipe(
  v.array(v.strictObject(entryCollectionEntries)),
  v.check((items) => unique(items, (item) => item.collectionId)),
)

const nullableDate = v.nullable(partialDateSchema)

const nullableCount = v.nullable(nonnegativeInteger)

export const entryCommonEntries = {
  name: nonemptyText,
  originalName: v.nullable(text),
  sortName: v.nullable(text),
  aliases: v.array(nonemptyText),

  description: v.nullable(text),
  primaryImageId: v.nullable(id),

  externalLinks: v.array(externalLinkSchema),
  externalIdentities: identitiesSchema,

  isNsfw: v.boolean(),
  addedDate: nullableDate,
}

const workEntries = {
  releaseDate: nullableDate,
  originalLanguages: v.pipe(
    v.array(languageSchema),
    v.check((items) => unique(items, (item) => item)),
  ),

  backdropImageId: v.nullable(id),
  titleLogoId: v.nullable(id),
}

const serialEntries = {
  releaseStatus: v.nullable(releaseStatusSchema),
  releaseEndDate: nullableDate,
}

export const entrySpecificEntries = {
  game: { ...workEntries, iconImageId: v.nullable(id) },

  anime: {
    ...workEntries,
    ...serialEntries,
    declaredDurationMs: nullableCount,
    declaredRegularEpisodeCount: nullableCount,
    declaredSpecialEpisodeCount: nullableCount,
  },

  comic: {
    ...workEntries,
    ...serialEntries,
    declaredPageCount: nullableCount,
    declaredVolumeCount: nullableCount,
    declaredChapterCount: nullableCount,
  },

  novel: {
    ...workEntries,
    ...serialEntries,
    declaredPageCount: nullableCount,
    declaredVolumeCount: nullableCount,
  },

  character: {
    birthDate: nullableDate,
    gender: v.nullable(genderSchema),
    bloodType: v.nullable(v.picklist(['a', 'b', 'ab', 'o'])),

    age: v.nullable(measureSchema),
    height: v.nullable(measureSchema),
    weight: v.nullable(measureSchema),
    bust: v.nullable(measureSchema),
    waist: v.nullable(measureSchema),
    hips: v.nullable(measureSchema),
    cupSize: v.nullable(text),
  },

  person: { birthDate: nullableDate, deathDate: nullableDate, gender: v.nullable(genderSchema) },

  organization: { foundedDate: nullableDate, dissolvedDate: nullableDate },
} as const

/** Exact identity equality never normalizes, splits or truncates the source's opaque ID. */
export function sameExternalIdentity(left: ExternalIdentity, right: ExternalIdentity): boolean {
  return left.source === right.source && left.sourceId === right.sourceId
}

/** An unambiguous internal map key; JSON encoding does not change identity comparison semantics. */
export function identityKey(value: ExternalIdentity): string {
  return JSON.stringify([value.source, value.sourceId])
}

/** Validate an entry reference without proving current existence or visibility. */
export function parseEntryRef(input: unknown): EntryRef {
  return parseValue(entryRefSchema, input, 'Invalid entry reference')
}

/** Validate that a reference uses one of the four work types. */
export function parseWorkRef(input: unknown): WorkRef {
  return parseValue(workRefSchema, input, 'Invalid work reference')
}

/** Validate a real part reference; ownership is a separate business check. */
export function parsePartRef(input: unknown): PartRef {
  return parseValue(partRefSchema, input, 'Invalid part reference')
}

/** Validate a complete source identity while preserving sourceId bytes as text. */
export function parseExternalIdentity(input: unknown): ExternalIdentity {
  return parseValue(identitySchema, input, 'Invalid external identity')
}

/** Require the same exact identity only once; multiple different IDs from the same source are legal. */
export function parseExternalIdentities(input: unknown): readonly ExternalIdentity[] {
  return parseValue(identitiesSchema, input, 'Invalid external identities')
}

/** Normalize the language tag through the distribution package's shared canonicalization rule. */
export function parseLanguageTag(input: unknown): LanguageTag {
  return parseValue(languageSchema, input, 'Invalid language tag')
}

/** A resource interface is checked only for shape here. The host validates actual ownership and retention. */
export const preparedSchema = v.pipe(v.unknown(), v.transform(parsePreparedAttachment))

export function membershipSchema<T extends v.GenericSchema>(
  member: T,
  key: (item: v.InferOutput<T>) => string,
) {
  const members = v.pipe(
    v.array(member),
    v.check((items) => unique(items, key)),
  )
  return v.variant('type', [
    v.strictObject({ type: v.literal('replace'), items: members }),
    v.pipe(
      v.strictObject({
        type: v.literal('modify'),
        add: v.exactOptional(members),
        remove: v.exactOptional(
          v.pipe(
            v.array(id),
            v.check((items) => unique(items, (item) => item)),
          ),
        ),
      }),
      v.check(
        (value) =>
          (value.add?.length ?? 0) + (value.remove?.length ?? 0) > 0 &&
          !(value.add ?? []).some((item) => value.remove?.includes(key(item))),
      ),
    ),
  ])
}

export const entryTagChangeSchema = membershipSchema(entryTagInputSchema, (item) => item.tagId)

export const entryCollectionChangeSchema = membershipSchema(
  entryCollectionInputSchema,
  (item) => item.collectionId,
)

/** Parse complete replacement or disjoint incremental tag intent, preserving the requested order. */
export function parseEntryTagChange(input: unknown): EntryTagChange {
  return parseValue(entryTagChangeSchema, input, 'Invalid entry tag change')
}

/** Parse collection intent; its item order never creates an entry-side collection order. */
export function parseEntryCollectionChange(input: unknown): EntryCollectionChange {
  return parseValue(entryCollectionChangeSchema, input, 'Invalid entry collection change')
}

function entryCreateSchema<T extends EntryType>(type: T) {
  return v.strictObject({
    type: v.literal(type),
    ...optionalFields({ ...entryCommonEntries, ...entrySpecificEntries[type] }),
    name: nonemptyText,
    evaluation: v.exactOptional(v.strictObject(optionalFields(evaluationEntries))),
    record: v.exactOptional(
      isWorkType(type) ? v.strictObject(optionalFields(recordEntries)) : v.never(),
    ),
    completionRecords: v.exactOptional(
      isWorkType(type) ? v.array(completionFieldsSchema) : v.never(),
    ),
    tags: v.exactOptional(
      v.pipe(
        v.array(entryTagInputSchema),
        v.check((items) => unique(items, (item) => item.tagId)),
      ),
    ),
    collections: v.exactOptional(
      v.pipe(
        v.array(entryCollectionInputSchema),
        v.check((items) => unique(items, (item) => item.collectionId)),
      ),
    ),
    prepared: v.exactOptional(v.array(preparedSchema)),
  })
}

/** Determine a trusted type's work membership without normalizing unknown external input. */
export function isWorkType(type: EntryType): type is WorkType {
  return workTypes.some((value) => value === type)
}

/** Parse seven closed creation branches, rejecting private values on non-work entries and derived fields everywhere. */
export function parseEntryCreate(input: unknown): EntryCreateInput {
  const { type } = parseValue(
    v.looseObject({ type: v.picklist(entryTypes) }),
    input,
    'Invalid entry creation',
  )

  // The selected schema and its work-only fields were chosen by the validated discriminator.
  return parseValue(entryCreateSchema(type), input, 'Invalid entry creation') as EntryCreateInput
}

/** Parse an edit and validate every expected field against its actual save unit; empty changes stay a no-op. */
export function parseEntryUpdate(input: unknown): EntryUpdate {
  const { ref } = parseValue(v.looseObject({ ref: entryRefSchema }), input, 'Invalid entry edit')
  const catalog = { ...entryCommonEntries, ...entrySpecificEntries[ref.type] }
  const personal = {
    evaluation: v.strictObject(optionalFields(evaluationEntries)),
    record: isWorkType(ref.type) ? v.strictObject(optionalFields(recordEntries)) : v.never(),
  }
  const value = parseValue(
    v.strictObject({
      ref: entryRefSchema,
      changes: v.strictObject(
        optionalFields({
          ...catalog,
          ...personal,
          tags: entryTagChangeSchema,
          collections: entryCollectionChangeSchema,
        }),
      ),
      expected: v.exactOptional(
        v.strictObject(
          optionalFields({
            ...catalog,
            ...personal,
            tags: entryTagsSchema,
            collections: entryCollectionsSchema,
          }),
        ),
      ),
      prepared: v.exactOptional(v.array(preparedSchema)),
    }),
    input,
    'Invalid entry edit',
  )

  validateExpectedKeys(value.changes, value.expected)
  validateExpectedKeys(value.changes.evaluation ?? {}, value.expected?.evaluation)
  if (isWorkType(ref.type)) {
    const changes = value.changes as EntryChanges<WorkType>
    const expected = value.expected as EntryExpected<WorkType> | undefined
    validateExpectedKeys(changes.record ?? {}, expected?.record)
  }

  for (const key of ['tags', 'collections'] as const) {
    if (
      value.expected &&
      Object.hasOwn(value.expected, key) &&
      value.changes[key]?.type !== 'replace'
    ) {
      throw new DesktopError(
        'InvalidInput',
        'Whole membership baselines require replacement intent',
      )
    }
  }

  return value as EntryUpdate
}

/** A complete caller-fixed collection of entry identities, with no selection-session token or implicit cap. */
export function parseEntryRefs(input: unknown): NonEmptyArray<EntryRef> {
  return parseValue(
    v.pipe(
      v.tupleWithRest([entryRefSchema], entryRefSchema),
      v.check((items) => unique(items, (item) => JSON.stringify([item.type, item.id]))),
    ),
    input,
    'Invalid entry selection',
  )
}

/** Only actual file-bearing work types own recognition profiles. */
export type FileWorkType = 'anime' | 'comic' | 'novel'
