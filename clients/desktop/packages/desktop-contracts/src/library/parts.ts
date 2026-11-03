/** @fileoverview Defines real part catalog operations, anime kind corrections and comic volume membership. */

import * as v from 'valibot'
import { DesktopError } from '../errors'
import type { PartialDate } from '../date'
import type { ListOptions, ListResult, NonEmptyArray, CallOptions } from '../operations'
import type { PreparedAttachment } from '../resources'
import {
  id,
  nonnegativeInteger,
  optionalFields,
  parseValue,
  text,
  unique,
  validateExpectedKeys,
} from '../validation'
import {
  entryRefSchema,
  externalLinkSchema,
  identitiesSchema,
  parsePartRef,
  partRefSchema,
  partTypes,
  partialDateSchema,
  preparedSchema,
} from './catalog'
import type {
  AnimeEpisodeType,
  AnimeExtraType,
  EntryRef,
  ExternalIdentity,
  ExternalLink,
  PartRef,
  PartType,
  PartWorkType,
} from './catalog'
import type { MoveInput, ReorderInput } from './ordering'

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

/** Kind-specific source facts; classification type and displayed number never determine identity or ordering. */
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

export type PartFields<T extends PartType> = PartCommonFields & PartSpecificFields[T]
export type PartCreateFields<T extends PartType> = Partial<PartFields<T>>

/** Type-qualified creation; omitted fields use their domain defaults and completed defaults to false. */
export type PartCreate<T extends PartType = PartType> = {
  [K in T]: {
    readonly type: K
    readonly work: EntryRef<PartWorkType<K>>
    readonly data: PartCreateFields<K>
    readonly completed?: boolean
    readonly prepared?: readonly PreparedAttachment[]
  }
}[T]

/** Ordinary edits do not change the part kind, owner, completion mark, order or technical times. */
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
    readonly createdAt: number
    readonly updatedAt: number
  }
}[T]

/** Lists stay within one real owner/kind and use its saved order; classification null explicitly selects unknown. */
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

/** Changing kind preserves ID and content; the target receives only its own classification and optional numbering. */
export type PartKindTarget =
  | {
      readonly kind: 'animeEpisode'
      readonly type: AnimeEpisodeType | null
      readonly numberLabel: string | null
    }
  | { readonly kind: 'animeExtra'; readonly type: AnimeExtraType | null }

/** A correction replaces kind-specific fields and only the explicitly changed common facts. */
export interface PartKindChange {
  readonly target: PartKindTarget
  readonly changes: Partial<PartCommonFields & { readonly declaredDurationMs: number | null }>
  readonly expected?: Partial<
    PartCommonFields & {
      readonly declaredDurationMs: number | null
      readonly type: AnimeEpisodeType | AnimeExtraType | null
      readonly numberLabel: string | null
    }
  >
  readonly prepared?: readonly PreparedAttachment[]
}

/** A volume's own chapter numbering and order never replace the chapter's work-level number. */
export interface VolumeChapter {
  readonly chapter: PartRef<'comicChapter'>
  readonly numberLabel: string | null
}

export type VolumeChapterChange =
  | { readonly type: 'replace'; readonly items: readonly VolumeChapter[] }
  | {
      readonly type: 'modify'
      readonly add?: readonly VolumeChapter[]
      readonly remove?: readonly PartRef<'comicChapter'>[]
    }

/** Actual part operations commit related references together; failures do not return partial identity migrations. */
export interface PartsApi {
  list(query: PartQuery, options: ListOptions, call?: CallOptions): Promise<ListResult<PartDetails>>
  get(ref: PartRef, call?: CallOptions): Promise<PartDetails | null>

  create(input: PartCreate, call?: CallOptions): Promise<PartRef>
  update(
    ...args: {
      [K in PartType]: [ref: PartRef<K>, input: Omit<PartUpdate<K>, 'ref'>, call?: CallOptions]
    }[PartType]
  ): Promise<void>
  delete(refs: PartRef | NonEmptyArray<PartRef>, call?: CallOptions): Promise<void>

  /** Merge only the same kind within one work; completed is the union, target preference and filled facts win. */
  merge(
    input: {
      [K in PartType]: { readonly source: PartRef<K>; readonly target: PartRef<K> }
    }[PartType],
    call?: CallOptions,
  ): Promise<PartRef>
  changeKind(
    ref: PartRef<'animeEpisode' | 'animeExtra'>,
    input: PartKindChange,
    call?: CallOptions,
  ): Promise<PartRef<'animeEpisode' | 'animeExtra'>>

  reorder(scope: PartOrderScope, input: ReorderInput, call?: CallOptions): Promise<void>
  move(scope: PartOrderScope, input: MoveInput, call?: CallOptions): Promise<void>

  /** Set the part mark only; this never creates or clears a work completion record. */
  setCompleted(ref: PartRef, completed: boolean, call?: CallOptions): Promise<void>
  setCompletedMany(
    refs: NonEmptyArray<PartRef>,
    completed: boolean,
    call?: CallOptions,
  ): Promise<void>

  readonly volumeChapters: VolumeChaptersApi
}

/** The owner and part kind identify the complete ordering side, not a filtered result page. */
export type PartOrderScope = {
  [K in PartType]: { readonly work: EntryRef<PartWorkType<K>>; readonly partType: K }
}[PartType]

/** Comic volume membership only; both endpoints must belong to the same comic at commit. */
export interface VolumeChaptersApi {
  list(
    volumeId: string,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<VolumeChapter>>

  applyChanges(
    volumeId: string,
    input: { readonly change: VolumeChapterChange; readonly expected?: readonly VolumeChapter[] },
    call?: CallOptions,
  ): Promise<void>
  update(
    volumeId: string,
    chapterId: string,
    input: {
      readonly numberLabel: string | null
      readonly expected?: { readonly numberLabel: string | null }
    },
    call?: CallOptions,
  ): Promise<void>

  reorder(volumeId: string, input: ReorderInput, call?: CallOptions): Promise<void>
  move(volumeId: string, input: MoveInput, call?: CallOptions): Promise<void>
}

export const partCommonEntries = {
  name: v.nullable(text),
  originalName: v.nullable(text),
  aliases: v.array(text),

  description: v.nullable(text),
  primaryImageId: v.nullable(id),

  externalLinks: v.array(externalLinkSchema),
  externalIdentities: identitiesSchema,
  releaseDate: v.nullable(partialDateSchema),
}

export const episodeTypeSchema = v.picklist(['regular', 'special'])
export const extraTypeSchema = v.picklist(['opening', 'ending', 'promotion', 'interview', 'other'])
const nullableCount = v.nullable(nonnegativeInteger)

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

/** Return the sole legal work kind for this real part kind. */
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

/** Validate source fields and the owner/kind relationship without fabricating a title or Part row. */
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

/** Reject unrelated baselines and noneditable identity/order/record fields. */
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

/** Validate one opposite-kind correction; removed source classification/number may be compared as context. */
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
  return value
}

/** Validate list intent while keeping local title filtering and saved classification semantics distinct. */
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

/** Parse explicit comic chapter membership; duplicates and add/remove contradictions are invalid. */
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
