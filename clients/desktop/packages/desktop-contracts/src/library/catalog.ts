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

/** The four entry kinds that support work-specific catalog and usage behavior. */
export const workTypes = Object.freeze(['game', 'anime', 'comic', 'novel'] as const)

/** The five real part kinds, each owned by its corresponding work medium. */
export const partTypes = Object.freeze([
  'novelVolume',
  'comicVolume',
  'comicChapter',
  'animeEpisode',
  'animeExtra',
] as const)

/** The seven independently cataloged entry kinds. */
export type EntryType = (typeof entryTypes)[number]

/** Entry kinds that own usage records and playable or readable local content. */
export type WorkType = (typeof workTypes)[number]

/** The five independently identified part kinds owned by anime, comic or novel works. */
export type PartType = (typeof partTypes)[number]

/** A type-qualified catalog identity. The type never grants access to an otherwise hidden object. */
export interface EntryRef<T extends EntryType = EntryType> {
  readonly type: T
  readonly id: string
}

/** A type-qualified catalog reference restricted to works. */
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

/** An explicitly known ABO blood-group classification. */
export type BloodType = 'a' | 'b' | 'ab' | 'o'

/** The user's current plan or usage arrangement for a work, separate from completion history. */
export type WorkStatus = 'planned' | 'active' | 'onHold'

/** A work's publication lifecycle, independent of the user's usage state. */
export type ReleaseStatus = 'planned' | 'ongoing' | 'finished' | 'paused' | 'cancelled'

/** The regular or special classification of a numbered anime episode. */
export type AnimeEpisodeType = 'regular' | 'special'

/** The content role of an anime extra outside the episode catalog. */
export type AnimeExtraType = 'opening' | 'ending' | 'promotion' | 'interview' | 'other'

/** A definite nonnegative quantity or the full nonempty source wording; no inferred units or range truncation. */
export type CharacterMeasure =
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'text'; readonly value: string }

/**
 * Editable catalog facts shared by every entry kind.
 *
 * Bodies and dates are whole replacement values. Null explicitly clears nullable facts.
 */
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

/**
 * Catalog facts shared by works.
 *
 * Original languages describe creative language rather than subtitles or the UI locale.
 */
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

/**
 * Explicit character biography and measurements.
 *
 * Numeric age uses years, height and circumferences use centimetres, and weight uses kilograms.
 */
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

/**
 * Catalog fields owned by each entry kind.
 *
 * Declared counts and duration are nullable nonnegative safe integers.
 */
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

/**
 * An entry's personal rating and favorite choice.
 *
 * Rating is an integer from 0 to 100 or null. An absent saved evaluation reads as null rating and
 * false favorite.
 */
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

/**
 * A tag association supplied for creation or membership changes.
 *
 * New associations default note to null and isSpoiler to false. Omitted attributes on existing
 * associations remain unchanged.
 */
export interface EntryTagInput {
  readonly tagId: string
  readonly note?: string | null
  readonly isSpoiler?: boolean
}

/**
 * A collection association with an optional note.
 *
 * New associations default the note to null; an omitted note preserves an existing association's
 * value.
 */
export interface EntryCollectionInput {
  readonly collectionId: string
  readonly note?: string | null
}

/**
 * Complete entry-side tag replacement or disjoint incremental membership changes.
 *
 * Only replacement can compare a whole-set baseline.
 */
export type EntryTagChange =
  | { readonly type: 'replace'; readonly items: readonly EntryTagInput[] }
  | {
      readonly type: 'modify'
      readonly add?: readonly EntryTagInput[]
      readonly remove?: readonly string[]
    }

/**
 * Complete entry-side collection replacement or disjoint incremental membership changes.
 *
 * Collection display order remains globally owned.
 */
export type EntryCollectionChange =
  | { readonly type: 'replace'; readonly items: readonly EntryCollectionInput[] }
  | {
      readonly type: 'modify'
      readonly add?: readonly EntryCollectionInput[]
      readonly remove?: readonly string[]
    }

/**
 * Explicit changes to editable catalog, personal and membership facts.
 *
 * Omission preserves a field; null clears only nullable values. Work records apply only to work
 * entries.
 */
export type EntryChanges<T extends EntryType> = Partial<EntryFields<T>> & {
  readonly evaluation?: Partial<Evaluation>
  readonly tags?: EntryTagChange
  readonly collections?: EntryCollectionChange
} & (T extends WorkType ? { readonly record?: Partial<WorkRecord> } : { readonly record?: never })

/**
 * Expected values for the independent fields and whole replacements being changed.
 *
 * Formal membership baselines include hidden associations.
 */
export type EntryExpected<T extends EntryType> = Partial<EntryFields<T>> & {
  readonly evaluation?: Partial<Evaluation>
  readonly tags?: readonly EntryTag[]
  readonly collections?: readonly EntryCollection[]
} & (T extends WorkType ? { readonly record?: Partial<WorkRecord> } : { readonly record?: never })

/** A new entry's required name and type-specific catalog and personal inputs. */
export type EntryCreate<T extends EntryType = EntryType> = {
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

/**
 * An atomic edit of one type-qualified entry with optional baselines and prepared resources.
 *
 * Prepared holds support the submitted changes without expanding the saved field set.
 */
export type EntryUpdate<T extends EntryType = EntryType> = {
  [K in T]: {
    readonly ref: EntryRef<K>
    readonly changes: EntryChanges<K>
    readonly expected?: EntryExpected<K>
    readonly prepared?: readonly PreparedAttachment[]
  }
}[T]

/**
 * An entry's catalog details, personal facts and derived summaries.
 *
 * Long descriptions and complete relations have dedicated reads. Derived summaries are read-only.
 */
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

/** Stable local entry identity qualified by one of the seven entry kinds. */
export const entryRefSchema = v.strictObject({ type: v.picklist(entryTypes), id })

/** Stable local entry reference restricted to the four work kinds. */
export const workRefSchema = v.strictObject({ type: v.picklist(workTypes), id })

/** Stable local part identity qualified by its concrete part kind. */
export const partRefSchema = v.strictObject({ type: v.picklist(partTypes), id })

/** Known civil-date components validated through the shared calendar contract. */
export const partialDateSchema = v.pipe(v.unknown(), v.transform(parsePartialDate))

/** Complete civil-date values validated without timestamp or timezone conversion. */
export const calendarDateSchema = v.pipe(v.unknown(), v.transform(parseCalendarDate))

/** Parses a language tag without dropping script, region or collation identifiers. */
export const languageSchema = v.pipe(
  nonemptyText,
  v.transform((value) => parseExternalValue(normalizeLocale, value, 'Invalid language tag')),
)

/** Exact external source coordinates, preserving the complete source item identity. */
export const identitySchema = v.strictObject({
  source: v.pipe(nonemptyText, v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)),
  sourceId: nonemptyText,
})

/** External source bindings that reject repeated source-coordinate pairs. */
export const identitiesSchema = v.pipe(
  v.array(identitySchema),
  v.check((items) => unique(items, identityKey)),
)

/** A descriptive link with nonblank label and target text. */
export const externalLinkSchema = v.strictObject({ name: nonemptyText, url: nonemptyText })

/** Ordered aliases shared by entries and parts; every item retains nonblank source text. */
export const aliasesSchema = v.array(nonemptyText)

/** Ordered descriptive links accepted by catalog and part values. */
export const externalLinksSchema = v.array(externalLinkSchema)

/** Canonical language tags retained in order with no duplicate language identity. */
export const languagesSchema = v.pipe(
  v.array(languageSchema),
  v.check((items) => unique(items, (item) => item)),
)

/** The shared finite gender vocabulary for character and person facts. */
export const genderSchema = v.picklist(['male', 'female', 'nonBinary', 'genderless', 'other'])

/** Current personal work status, separate from completion history. */
export const statusSchema = v.picklist(['planned', 'active', 'onHold'])

/** Publication-progress vocabulary used by serial work catalog facts. */
export const releaseStatusSchema = v.picklist([
  'planned',
  'ongoing',
  'finished',
  'paused',
  'cancelled',
])

/** A definite nonnegative character measurement or complete nonblank source wording. */
export const measureSchema = v.variant('kind', [
  v.strictObject({ kind: v.literal('number'), value: nonnegativeNumber }),
  v.strictObject({ kind: v.literal('text'), value: nonemptyText }),
])

/** Independent personal rating and favorite fields shared by every entry kind. */
export const evaluationEntries = { rating: v.nullable(rating), favorite: v.boolean() }

/** Current personal work status and additional duration, independent of recorded activity. */
export const recordEntries = {
  status: v.nullable(statusSchema),
  additionalDurationMs: nonnegativeInteger,
}

/** One completion fact with an optional complete date and blank-note normalization. */
export const completionFieldsSchema = v.strictObject({
  completedDate: v.nullable(calendarDateSchema),
  note: v.pipe(
    v.nullable(text),
    v.transform((value) => (value === null || value.trim().length === 0 ? null : value)),
  ),
})

/** Saved tag-application identity, note and spoiler attributes. */
export const entryTagEntries = { tagId: id, note: v.nullable(text), isSpoiler: v.boolean() }

/** Saved collection-membership identity and its independent note. */
export const entryCollectionEntries = { collectionId: id, note: v.nullable(text) }

/** Explicit tag-application input with optional relationship attributes. */
export const entryTagInputSchema = v.strictObject({
  tagId: id,
  ...optionalFields({ note: v.nullable(text), isSpoiler: v.boolean() }),
})

/** Explicit collection-membership input with an optional note. */
export const entryCollectionInputSchema = v.strictObject({
  collectionId: id,
  note: v.exactOptional(v.nullable(text)),
})

/** Saved tag applications with one row per tag identity. */
export const entryTagsSchema = v.pipe(
  v.array(v.strictObject(entryTagEntries)),
  v.check((items) => unique(items, (item) => item.tagId)),
)

/** Saved collection memberships with one row per collection identity. */
export const entryCollectionsSchema = v.pipe(
  v.array(v.strictObject(entryCollectionEntries)),
  v.check((items) => unique(items, (item) => item.collectionId)),
)

/** Optional partial catalog date, retaining null as a distinct unset value. */
const nullableDate = v.nullable(partialDateSchema)

/** Optional declared count whose known value is a nonnegative safe integer. */
const nullableCount = v.nullable(nonnegativeInteger)

/** Descriptive facts and identity bindings shared by all entry creation and edit contracts. */
export const entryCommonEntries = {
  name: nonemptyText,
  originalName: v.nullable(text),
  sortName: v.nullable(text),
  aliases: aliasesSchema,

  description: v.nullable(text),
  primaryImageId: v.nullable(id),

  externalLinks: externalLinksSchema,
  externalIdentities: identitiesSchema,

  isNsfw: v.boolean(),
  addedDate: nullableDate,
}

/** Catalog facts shared by the four work media, separate from personal records. */
const workEntries = {
  releaseDate: nullableDate,
  originalLanguages: languagesSchema,

  backdropImageId: v.nullable(id),
  titleLogoId: v.nullable(id),
}

/** Publication status and end date for serial media. */
const serialEntries = {
  releaseStatus: v.nullable(releaseStatusSchema),
  releaseEndDate: nullableDate,
}

/** Catalog field vocabulary and validators owned by each concrete entry kind. */
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

/** Compares source and opaque source ID exactly, without normalization or truncation. */
export function sameExternalIdentity(left: ExternalIdentity, right: ExternalIdentity): boolean {
  return left.source === right.source && left.sourceId === right.sourceId
}

/** Encodes a complete external identity as an unambiguous internal map key. */
export function identityKey(value: ExternalIdentity): string {
  return JSON.stringify([value.source, value.sourceId])
}

/** Parses a type-qualified entry reference without checking current existence or visibility. */
export function parseEntryRef(input: unknown): EntryRef {
  return parseValue(entryRefSchema, input, 'Invalid entry reference')
}

/** Parses a reference restricted to the four work kinds. */
export function parseWorkRef(input: unknown): WorkRef {
  return parseValue(workRefSchema, input, 'Invalid work reference')
}

/** Parses a real part reference; the business owner separately checks work ownership. */
export function parsePartRef(input: unknown): PartRef {
  return parseValue(partRefSchema, input, 'Invalid part reference')
}

/** Parses a complete source identity while preserving the opaque source ID text. */
export function parseExternalIdentity(input: unknown): ExternalIdentity {
  return parseValue(identitySchema, input, 'Invalid external identity')
}

/** Parses distinct complete identities, allowing different IDs from the same source. */
export function parseExternalIdentities(input: unknown): readonly ExternalIdentity[] {
  return parseValue(identitiesSchema, input, 'Invalid external identities')
}

/** Normalizes a language tag through the shared distribution locale rules. */
export function parseLanguageTag(input: unknown): LanguageTag {
  return parseValue(languageSchema, input, 'Invalid language tag')
}

/** Parses a complete ordered list of nonblank entry or part aliases. */
export function parseAliases(input: unknown): readonly string[] {
  return parseValue(aliasesSchema, input, 'Invalid catalog aliases')
}

/** Parses descriptive links independently of a catalog operation. */
export function parseExternalLinks(input: unknown): readonly ExternalLink[] {
  return parseValue(externalLinksSchema, input, 'Invalid external links')
}

/** Parses distinct canonical language tags without reordering them. */
export function parseLanguages(input: unknown): readonly LanguageTag[] {
  return parseValue(languagesSchema, input, 'Invalid catalog languages')
}

/** Parses a numeric measurement or its original descriptive wording. */
export function parseCharacterMeasure(input: unknown): CharacterMeasure {
  return parseValue(measureSchema, input, 'Invalid character measurement')
}

/** A resource interface is checked only for shape here. The host validates actual ownership and retention. */
export const preparedSchema = v.pipe(v.unknown(), v.transform(parsePreparedAttachment))

/**
 * Builds complete-replacement and incremental-membership schemas for keyed members.
 *
 * Rejects duplicate members, empty incremental intent and overlapping add/remove identities.
 */
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

/** Whole replacement or explicit tag-membership edits with conflict checks by tag identity. */
export const entryTagChangeSchema = membershipSchema(entryTagInputSchema, (item) => item.tagId)

/**
 * Whole replacement or explicit collection-membership edits with conflict checks by collection
 * identity.
 */
export const entryCollectionChangeSchema = membershipSchema(
  entryCollectionInputSchema,
  (item) => item.collectionId,
)

/** Parses tag replacement or disjoint incremental intent while preserving requested order. */
export function parseEntryTagChange(input: unknown): EntryTagChange {
  return parseValue(entryTagChangeSchema, input, 'Invalid entry tag change')
}

/** Parses collection membership intent without creating entry-side collection ordering. */
export function parseEntryCollectionChange(input: unknown): EntryCollectionChange {
  return parseValue(entryCollectionChangeSchema, input, 'Invalid entry collection change')
}

/** Builds the creation schema for one entry kind and its applicable personal facts. */
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

/** Checks whether a known entry kind belongs to the work subset. */
export function isWorkType(type: EntryType): type is WorkType {
  return workTypes.some((value) => value === type)
}

/**
 * Parses creation fields for the selected entry kind.
 *
 * Work records and completion history are restricted to works; derived fields are rejected.
 */
export function parseEntryCreate(input: unknown): EntryCreate {
  const { type } = parseValue(
    v.looseObject({ type: v.picklist(entryTypes) }),
    input,
    'Invalid entry creation',
  )

  // The selected schema and its work-only fields were chosen by the validated discriminator.
  return parseValue(entryCreateSchema(type), input, 'Invalid entry creation') as EntryCreate
}

/**
 * Parses an entry edit and checks expected fields against their actual save units.
 *
 * Whole membership baselines require replacement intent. Empty changes remain a no-op.
 */
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

/** Parses a nonempty, distinct collection of caller-fixed entry identities. */
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

/** Work kinds with file-based holdings and recognition profiles. */
export type FileWorkType = 'anime' | 'comic' | 'novel'
