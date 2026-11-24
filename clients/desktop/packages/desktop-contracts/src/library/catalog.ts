import { membershipChangeSchema } from './membership'
import * as v from 'valibot'
import {
  fromParser,
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
import { parsePartialDate, parseCalendarDate, type PartialDate, type CalendarDate } from '../date'
import { normalizeLocale } from '@kisaki3/extension-distribution/metadata'
import { parsePreparedAttachment, type PreparedAttachment } from '../resources'
import { DesktopError } from '../errors'
import type { NonEmptyArray } from '../operations'

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

export type EntryType = (typeof entryTypes)[number]

export type WorkType = (typeof workTypes)[number]

export type PartType = (typeof partTypes)[number]

export interface EntryRef<T extends EntryType = EntryType> {
  readonly type: T
  readonly id: string
}

export type WorkRef<T extends WorkType = WorkType> = EntryRef<T>

export interface PartRef<T extends PartType = PartType> {
  readonly type: T
  readonly id: string
}

export type PartWorkType<T extends PartType> = T extends 'novelVolume'
  ? 'novel'
  : T extends 'comicVolume' | 'comicChapter'
    ? 'comic'
    : 'anime'

export interface ExternalIdentity {
  readonly source: string
  readonly sourceId: string
}

export interface ExternalLink {
  readonly name: string
  readonly url: string
}

export type LanguageTag = string

export type Gender = 'male' | 'female' | 'nonBinary' | 'genderless' | 'other'

export type BloodType = 'a' | 'b' | 'ab' | 'o'

export type WorkStatus = 'planned' | 'active' | 'onHold'

export type ReleaseStatus = 'planned' | 'ongoing' | 'finished' | 'paused' | 'cancelled'

export type AnimeEpisodeType = 'regular' | 'special'

export type AnimeExtraType = 'opening' | 'ending' | 'promotion' | 'interview' | 'other'

export type CharacterMeasure =
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'text'; readonly value: string }

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

export interface WorkFields {
  readonly releaseDate: PartialDate | null
  readonly originalLanguages: readonly LanguageTag[]

  readonly backdropImageId: string | null
  readonly titleLogoId: string | null
}

export interface SerialWorkFields {
  readonly releaseStatus: ReleaseStatus | null
  readonly releaseEndDate: PartialDate | null
}

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

export type EntryFields<T extends EntryType> = EntryCommonFields & EntrySpecificFields[T]

export interface Evaluation {
  readonly rating: number | null
  readonly favorite: boolean
}

export interface WorkRecord {
  readonly status: WorkStatus | null
  readonly additionalDurationMs: number
}

export interface CompletionFields {
  readonly completedDate: CalendarDate | null
  readonly note: string | null
}

export interface EntryTag {
  readonly tagId: string
  readonly note: string | null
  readonly isSpoiler: boolean
}

export interface EntryCollection {
  readonly collectionId: string
  readonly note: string | null
}

export interface EntryTagInput {
  readonly tagId: string
  readonly note?: string | null
  readonly isSpoiler?: boolean
}

export interface EntryCollectionInput {
  readonly collectionId: string
  readonly note?: string | null
}

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

export type EntryChanges<T extends EntryType> = Partial<EntryFields<T>> & {
  readonly evaluation?: Partial<Evaluation>
  readonly tags?: EntryTagChange
  readonly collections?: EntryCollectionChange
} & (T extends WorkType ? { readonly record?: Partial<WorkRecord> } : { readonly record?: never })

export type EntryExpected<T extends EntryType> = Partial<EntryFields<T>> & {
  readonly evaluation?: Partial<Evaluation>
  readonly tags?: readonly EntryTag[]
  readonly collections?: readonly EntryCollection[]
} & (T extends WorkType ? { readonly record?: Partial<WorkRecord> } : { readonly record?: never })

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

export type EntryUpdate<T extends EntryType = EntryType> = {
  [K in T]: {
    readonly ref: EntryRef<K>
    readonly changes: EntryChanges<K>
    readonly expected?: EntryExpected<K>
    readonly prepared?: readonly PreparedAttachment[]
  }
}[T]

export type EntryDetails<T extends EntryType = EntryType> = {
  [K in T]: Omit<EntryFields<K>, 'description'> & {
    readonly id: string
    readonly type: K
    readonly createdAt: number
    readonly updatedAt: number
    readonly evaluation: Evaluation
  } & (K extends WorkType
      ? {
          readonly record: WorkRecord
          readonly totalDurationMs: number
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

export const partialDateSchema = fromParser(parsePartialDate)

export const calendarDateSchema = fromParser(parseCalendarDate)

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

export const aliasesSchema = v.array(nonemptyText)

export const externalLinksSchema = v.array(externalLinkSchema)

export const languagesSchema = v.pipe(
  v.array(languageSchema),
  v.check((items) => unique(items, (item) => item)),
)

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
  aliases: aliasesSchema,

  description: v.nullable(text),
  primaryImageId: v.nullable(id),

  externalLinks: externalLinksSchema,
  externalIdentities: identitiesSchema,

  isNsfw: v.boolean(),
  addedDate: nullableDate,
}

const workEntries = {
  releaseDate: nullableDate,
  originalLanguages: languagesSchema,

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

export function sameExternalIdentity(left: ExternalIdentity, right: ExternalIdentity): boolean {
  return left.source === right.source && left.sourceId === right.sourceId
}

export function identityKey(value: ExternalIdentity): string {
  return JSON.stringify([value.source, value.sourceId])
}

export function parseEntryRef(input: unknown): EntryRef {
  return parseValue(entryRefSchema, input, 'Invalid entry reference')
}

export function parseWorkRef(input: unknown): WorkRef {
  return parseValue(workRefSchema, input, 'Invalid work reference')
}

export function parsePartRef(input: unknown): PartRef {
  return parseValue(partRefSchema, input, 'Invalid part reference')
}

export function parseExternalIdentity(input: unknown): ExternalIdentity {
  return parseValue(identitySchema, input, 'Invalid external identity')
}

export function parseExternalIdentities(input: unknown): readonly ExternalIdentity[] {
  return parseValue(identitiesSchema, input, 'Invalid external identities')
}

export function parseLanguageTag(input: unknown): LanguageTag {
  return parseValue(languageSchema, input, 'Invalid language tag')
}

export function parseAliases(input: unknown): readonly string[] {
  return parseValue(aliasesSchema, input, 'Invalid catalog aliases')
}

export function parseExternalLinks(input: unknown): readonly ExternalLink[] {
  return parseValue(externalLinksSchema, input, 'Invalid external links')
}

export function parseLanguages(input: unknown): readonly LanguageTag[] {
  return parseValue(languagesSchema, input, 'Invalid catalog languages')
}

export function parseCharacterMeasure(input: unknown): CharacterMeasure {
  return parseValue(measureSchema, input, 'Invalid character measurement')
}

export const preparedSchema = fromParser(parsePreparedAttachment)

export const entryTagChangeSchema = membershipChangeSchema(
  entryTagInputSchema,
  id,
  (item) => item.tagId,
  (tagId) => tagId,
)

export const entryCollectionChangeSchema = membershipChangeSchema(
  entryCollectionInputSchema,
  id,
  (item) => item.collectionId,
  (collectionId) => collectionId,
)

export function parseEntryTagChange(input: unknown): EntryTagChange {
  return parseValue(entryTagChangeSchema, input, 'Invalid entry tag change')
}

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

export function isWorkType(type: EntryType): type is WorkType {
  return workTypes.some((value) => value === type)
}

export function parseEntryCreate(input: unknown): EntryCreate {
  const { type } = parseValue(
    v.looseObject({ type: v.picklist(entryTypes) }),
    input,
    'Invalid entry creation',
  )

  // The validated discriminator selects the schema and its work-only fields.
  return parseValue(entryCreateSchema(type), input, 'Invalid entry creation') as EntryCreate
}

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

export type FileWorkType = 'anime' | 'comic' | 'novel'
