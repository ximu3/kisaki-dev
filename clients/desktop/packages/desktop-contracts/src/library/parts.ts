/** @fileoverview Defines real part catalog operations, anime kind corrections and comic volume membership. */

import type {
  ExternalLink,
  ExternalIdentity,
  AnimeEpisodeType,
  AnimeExtraType,
  PartType,
  EntryRef,
  PartWorkType,
  PartRef,
} from './catalog'
import type { PartialDate } from '../date'
import type { PreparedAttachment } from '../resources'
import type { ListOptions, CallOptions, ListResult, NonEmptyArray } from '../operations'
import type { ReorderInput, MoveInput } from './ordering'
import * as v from 'valibot'
import {
  text,
  id,
  nonnegativeInteger,
  parseValue,
  optionalFields,
  validateExpectedKeys,
  unique,
} from '../validation'
import {
  aliasesSchema,
  externalLinksSchema,
  identitiesSchema,
  partialDateSchema,
  partTypes,
  preparedSchema,
  partRefSchema,
  parsePartRef,
  entryRefSchema,
} from './catalog'
import { DesktopError } from '../errors'

/** Shared part facts, with nullable real titles; UI placeholders are never stored as names. */
export interface PartCommonFields {
  readonly name: string | null
  readonly originalName: string | null
  readonly aliases: readonly string[]

  readonly description: string | null
  readonly primaryImageId: string | null

  readonly externalLinks: readonly ExternalLink[]
  readonly externalIdentities: readonly ExternalIdentity[]
  readonly releaseDate: PartialDate | null
}

/**
 * Source facts specific to each real part kind.
 *
 * Classification and displayed numbering do not determine identity or formal order.
 */
export interface PartSpecificFields {
  readonly novelVolume: {
    readonly numberLabel: string | null
    readonly declaredPageCount: number | null
  }

  readonly comicVolume: {
    readonly numberLabel: string | null
    readonly declaredPageCount: number | null
    readonly declaredChapterCount: number | null
  }

  readonly comicChapter: {
    readonly numberLabel: string | null
    readonly declaredPageCount: number | null
  }

  readonly animeEpisode: {
    readonly numberLabel: string | null
    readonly type: AnimeEpisodeType | null
    readonly declaredDurationMs: number | null
  }

  readonly animeExtra: {
    readonly type: AnimeExtraType | null
    readonly declaredDurationMs: number | null
  }
}

/** The complete editable catalog facts for one part kind. */
export type PartFields<T extends PartType> = PartCommonFields & PartSpecificFields[T]

/** Optional initial catalog values; omitted fields use the part kind's domain defaults. */
export type PartCreateFields<T extends PartType> = Partial<PartFields<T>>

/**
 * A new typed part with an explicit work owner and optional initial completion mark.
 *
 * Omitted catalog values use domain defaults, and completed defaults to false.
 */
export type PartCreate<T extends PartType = PartType> = {
  [K in T]: {
    readonly type: K
    readonly work: EntryRef<PartWorkType<K>>
    readonly data: PartCreateFields<K>
    readonly completed?: boolean
    readonly prepared?: readonly PreparedAttachment[]
  }
}[T]

/**
 * An ordinary part-field edit with optional expected values and prepared resources.
 *
 * Kind, owner, completion mark, order and technical times remain unchanged.
 */
export type PartUpdate<T extends PartType = PartType> = {
  [K in T]: {
    readonly ref: PartRef<K>
    readonly changes: Partial<PartFields<K>>
    readonly expected?: Partial<PartFields<K>>
    readonly prepared?: readonly PreparedAttachment[]
  }
}[T]

/** Complete real part details, separating kind identity from the anime classification in data.type. */
export type PartDetails<T extends PartType = PartType> = {
  [K in T]: {
    readonly ref: PartRef<K>
    readonly work: EntryRef<PartWorkType<K>>

    readonly data: PartFields<K>
    readonly completed: boolean
    readonly sortOrder: number

    /** UTC milliseconds since the Unix epoch. */
    readonly createdAt: number
    /** UTC milliseconds since the Unix epoch. */
    readonly updatedAt: number
  }
}[T]

/**
 * A filtered listing within one real work and part kind, using its saved order.
 *
 * Null classification explicitly selects unknown classifications.
 */
export type PartQuery<T extends PartType = PartType> = {
  [K in T]: {
    readonly work: EntryRef<PartWorkType<K>>
    readonly partType: K
    readonly search: string
    readonly completed?: boolean
  } & (K extends 'animeEpisode'
    ? { readonly classifications?: readonly (AnimeEpisodeType | null)[] }
    : K extends 'animeExtra'
      ? { readonly classifications?: readonly (AnimeExtraType | null)[] }
      : object)
}[T]

/**
 * The target anime part kind and its applicable classification and number fields.
 *
 * Kind correction preserves the part's ID and common content.
 */
export type PartKindTarget =
  | {
      readonly kind: 'animeEpisode'
      readonly type: AnimeEpisodeType | null
      readonly numberLabel: string | null
    }
  | { readonly kind: 'animeExtra'; readonly type: AnimeExtraType | null }

/** An opposite-kind anime correction with common-field edits and source-kind comparison values. */
export type PartKindChange<
  T extends 'animeEpisode' | 'animeExtra' = 'animeEpisode' | 'animeExtra',
> = {
  [K in T]: {
    readonly target: Extract<
      PartKindTarget,
      { readonly kind: K extends 'animeEpisode' ? 'animeExtra' : 'animeEpisode' }
    >
    readonly changes: Partial<PartCommonFields & { readonly declaredDurationMs: number | null }>
    readonly expected?: Partial<PartFields<K>>
    readonly prepared?: readonly PreparedAttachment[]
  }
}[T]

/**
 * A volume's chapter membership with volume-specific numbering.
 *
 * Membership order and numbering preserve the chapter's work-level values.
 */
export interface VolumeChapter {
  readonly chapter: PartRef<'comicChapter'>
  readonly numberLabel: string | null
}

/** Complete volume-chapter membership replacement or disjoint incremental changes. */
export type VolumeChapterChange =
  | { readonly type: 'replace'; readonly items: readonly VolumeChapter[] }
  | {
      readonly type: 'modify'
      readonly add?: readonly VolumeChapter[]
      readonly remove?: readonly PartRef<'comicChapter'>[]
    }

/**
 * Saved part facts, completion marks, formal order and explicit identity-preserving corrections.
 *
 * Related references commit together; failures do not return partial identity migrations.
 */
export interface PartsApi {
  /** Lists parts within one work and kind in saved order under the requested filters. */
  list<Q extends PartQuery>(
    query: Q,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<PartDetails<Q['partType']>>>

  /**
   * Reads saved part details, or null when absent, without opening content or changing completion.
   */
  get<T extends PartType>(ref: PartRef<T>, call?: CallOptions): Promise<PartDetails<T> | null>

  /**
   * Commits a part and its adopted content under the supplied work, returning its typed identity.
   */
  create<I extends PartCreate>(input: I, call?: CallOptions): Promise<PartRef<I['type']>>

  /**
   * Compares and saves changed part facts and related references while preserving owner and kind.
   */
  update(
    ...args: {
      [K in PartType]: [ref: PartRef<K>, input: Omit<PartUpdate<K>, 'ref'>, call?: CallOptions]
    }[PartType]
  ): Promise<void>

  /**
   * Deletes selected parts and updates dependent references together, preserving held media files.
   */
  delete(refs: PartRef | NonEmptyArray<PartRef>, call?: CallOptions): Promise<void>

  /**
   * Merges same-kind parts within one work into the explicit survivor.
   *
   * Completion marks combine; the target's preference and populated facts take precedence.
   */
  merge<
    I extends {
      [K in PartType]: { readonly source: PartRef<K>; readonly target: PartRef<K> }
    }[PartType],
  >(
    input: I,
    call?: CallOptions,
  ): Promise<I['target']>

  /**
   * Corrects an anime episode or extra in place, preserving identity and replacing kind fields
   * atomically.
   */
  changeKind<
    Args extends {
      [K in 'animeEpisode' | 'animeExtra']: [
        ref: PartRef<K>,
        input: PartKindChange<K>,
        call?: CallOptions,
      ]
    }['animeEpisode' | 'animeExtra'],
  >(
    ...args: Args
  ): Promise<PartRef<Args[1]['target']['kind']>>

  /**
   * Reorders selected slots against the complete work-and-kind baseline.
   *
   * Read filters do not narrow that baseline.
   */
  reorder(scope: PartOrderScope, input: ReorderInput, call?: CallOptions): Promise<void>

  /**
   * Moves supplied parts in input order within their current work-and-kind side, before an anchor
   * or at the end.
   */
  move(scope: PartOrderScope, input: MoveInput, call?: CallOptions): Promise<void>

  /** Sets one part's completion mark while preserving work completion history. */
  setCompleted(ref: PartRef, completed: boolean, call?: CallOptions): Promise<void>

  /** Sets all supplied part marks atomically while preserving work completion history. */
  setCompletedMany(
    refs: NonEmptyArray<PartRef>,
    completed: boolean,
    call?: CallOptions,
  ): Promise<void>

  readonly volumeChapters: VolumeChaptersApi
}

/** The work and part kind owning a complete formal order, independent of filtered result pages. */
export type PartOrderScope = {
  [K in PartType]: { readonly work: EntryRef<PartWorkType<K>>; readonly partType: K }
}[PartType]

/**
 * Comic-volume chapter membership, numbering and volume-side order.
 *
 * Both endpoints must belong to the same comic at commit.
 */
export interface VolumeChaptersApi {
  /** Lists a volume's chapter associations in saved volume-specific order. */
  list(
    volumeId: string,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<VolumeChapter>>

  /**
   * Compares and changes the volume's ordered chapter side atomically.
   *
   * Both endpoints must remain in the same comic.
   */
  applyChanges(
    volumeId: string,
    input: { readonly change: VolumeChapterChange; readonly expected?: readonly VolumeChapter[] },
    call?: CallOptions,
  ): Promise<void>

  /** Compares and changes a volume-specific chapter number, preserving its work-level number. */
  update(
    volumeId: string,
    chapterId: string,
    input: {
      readonly numberLabel: string | null
      readonly expected?: { readonly numberLabel: string | null }
    },
    call?: CallOptions,
  ): Promise<void>

  /** Reorders selected chapter slots against the complete volume-membership baseline. */
  reorder(volumeId: string, input: ReorderInput, call?: CallOptions): Promise<void>

  /**
   * Moves chapter associations in the volume's current order, preserving work-level chapter order.
   */
  move(volumeId: string, input: MoveInput, call?: CallOptions): Promise<void>
}

/** Descriptive part facts and exact source identities shared by all five real part kinds. */
export const partCommonEntries = {
  name: v.nullable(text),
  originalName: v.nullable(text),
  aliases: aliasesSchema,

  description: v.nullable(text),
  primaryImageId: v.nullable(id),

  externalLinks: externalLinksSchema,
  externalIdentities: identitiesSchema,
  releaseDate: v.nullable(partialDateSchema),
}

/** Regular or special episode classification, independent of display numbering. */
export const episodeTypeSchema = v.picklist(['regular', 'special'])

/** Content-role vocabulary for anime extras outside the episode catalog. */
export const extraTypeSchema = v.picklist(['opening', 'ending', 'promotion', 'interview', 'other'])

/** Optional declared part count whose known value is a nonnegative safe integer. */
const nullableCount = v.nullable(nonnegativeInteger)

/** Per-kind numbering, classification and declared-count fields used by part creation and edits. */
export const partSpecificEntries = {
  novelVolume: { numberLabel: v.nullable(text), declaredPageCount: nullableCount },

  comicVolume: {
    numberLabel: v.nullable(text),
    declaredPageCount: nullableCount,
    declaredChapterCount: nullableCount,
  },

  comicChapter: { numberLabel: v.nullable(text), declaredPageCount: nullableCount },

  animeEpisode: {
    numberLabel: v.nullable(text),
    type: v.nullable(episodeTypeSchema),
    declaredDurationMs: nullableCount,
  },

  animeExtra: { type: v.nullable(extraTypeSchema), declaredDurationMs: nullableCount },
} as const

/** Returns the sole owning work kind for a real part kind. */
export function partWorkType<T extends PartType>(type: T): PartWorkType<T> {
  const mapping: { [K in PartType]: PartWorkType<K> } = {
    novelVolume: 'novel',
    comicVolume: 'comic',
    comicChapter: 'comic',
    animeEpisode: 'anime',
    animeExtra: 'anime',
  }
  return mapping[type]
}

/** Parses initial part facts and checks the owner-kind relationship. */
export function parsePartCreate(input: unknown): PartCreate {
  const { type } = parseValue(
    v.looseObject({ type: v.picklist(partTypes) }),
    input,
    'Invalid part creation',
  )
  return parseValue(
    v.strictObject({
      type: v.literal(type),
      work: v.strictObject({ type: v.literal(partWorkType(type)), id }),
      data: v.strictObject(optionalFields({ ...partCommonEntries, ...partSpecificEntries[type] })),
      completed: v.exactOptional(v.boolean()),
      prepared: v.exactOptional(v.array(preparedSchema)),
    }),
    input,
    'Invalid part creation',
  ) as PartCreate
}

/** Parses editable part facts and expected values for the submitted fields. */
export function parsePartUpdate(input: unknown): PartUpdate {
  const { ref } = parseValue(v.looseObject({ ref: partRefSchema }), input, 'Invalid part edit')
  const fields = v.strictObject(
    optionalFields({ ...partCommonEntries, ...partSpecificEntries[ref.type] }),
  )
  const value = parseValue(
    v.strictObject({
      ref: partRefSchema,
      changes: fields,
      expected: v.exactOptional(fields),
      prepared: v.exactOptional(v.array(preparedSchema)),
    }),
    input,
    'Invalid part edit',
  )
  validateExpectedKeys(value.changes, value.expected)
  return value as PartUpdate
}

/**
 * Parses an opposite-kind anime correction and applicable comparison context.
 *
 * Removed source classification or numbering may be compared alongside changed common facts.
 */
export function parsePartKindChange<T extends 'animeEpisode' | 'animeExtra'>(
  ref: PartRef<T>,
  input: unknown,
): PartKindChange<T>

export function parsePartKindChange(
  ref: PartRef<'animeEpisode' | 'animeExtra'>,
  input: unknown,
): PartKindChange {
  parsePartRef(ref)
  if (ref.type !== 'animeEpisode' && ref.type !== 'animeExtra') {
    throw new DesktopError('InvalidInput', 'Only anime parts can change kind')
  }

  const target =
    ref.type === 'animeEpisode'
      ? v.strictObject({ kind: v.literal('animeExtra'), type: v.nullable(extraTypeSchema) })
      : v.strictObject({
          kind: v.literal('animeEpisode'),
          type: v.nullable(episodeTypeSchema),
          numberLabel: v.nullable(text),
        })
  const common = { ...partCommonEntries, declaredDurationMs: nullableCount }
  const expected = {
    ...common,
    type: v.nullable(ref.type === 'animeEpisode' ? episodeTypeSchema : extraTypeSchema),
    numberLabel: ref.type === 'animeEpisode' ? v.nullable(text) : v.never(),
  }
  const value = parseValue(
    v.strictObject({
      target,
      changes: v.strictObject(optionalFields(common)),
      expected: v.exactOptional(v.strictObject(optionalFields(expected))),
      prepared: v.exactOptional(v.array(preparedSchema)),
    }),
    input,
    'Invalid part kind correction',
  )
  validateExpectedKeys(
    value.changes,
    value.expected,
    ref.type === 'animeEpisode' ? ['type', 'numberLabel'] : ['type'],
  )
  return value as PartKindChange
}

/** Parses part filters and checks the owning work kind and applicable classifications. */
export function parsePartQuery(input: unknown): PartQuery {
  const { partType } = parseValue(v.looseObject({ partType: v.picklist(partTypes) }), input)
  let classification: v.GenericSchema = v.never()
  if (partType === 'animeEpisode') {
    classification = v.nullable(episodeTypeSchema)
  } else if (partType === 'animeExtra') {
    classification = v.nullable(extraTypeSchema)
  }
  const value = parseValue(
    v.strictObject({
      work: entryRefSchema,
      partType: v.literal(partType),
      search: text,
      completed: v.exactOptional(v.boolean()),
      classifications: v.exactOptional(
        partType === 'animeEpisode' || partType === 'animeExtra'
          ? v.pipe(
              v.array(classification),
              v.check((items) => new Set(items).size === items.length),
            )
          : v.never(),
      ),
    }),
    input,
    'Invalid part query',
  )
  if (value.work.type !== partWorkType(partType)) {
    throw new DesktopError('InvalidInput', 'Part kind does not belong to this work type')
  }

  return value as PartQuery
}

/**
 * Parses explicit chapter membership, rejecting duplicates and overlapping additions and removals.
 */
export function parseVolumeChapterChange(input: unknown): VolumeChapterChange {
  const ref = v.strictObject({ type: v.literal('comicChapter'), id })
  const member = v.strictObject({ chapter: ref, numberLabel: v.nullable(text) })
  const members = v.pipe(
    v.array(member),
    v.check((items) => unique(items, (item) => item.chapter.id)),
  )
  return parseValue(
    v.variant('type', [
      v.strictObject({ type: v.literal('replace'), items: members }),
      v.pipe(
        v.strictObject({
          type: v.literal('modify'),
          add: v.exactOptional(members),
          remove: v.exactOptional(
            v.pipe(
              v.array(ref),
              v.check((items) => unique(items, (item) => item.id)),
            ),
          ),
        }),
        v.check(
          (value) =>
            (value.add?.length ?? 0) + (value.remove?.length ?? 0) > 0 &&
            !(value.add ?? []).some((item) =>
              value.remove?.some((removed) => removed.id === item.chapter.id),
            ),
        ),
      ),
    ]),
    input,
    'Invalid volume chapter membership',
  )
}
