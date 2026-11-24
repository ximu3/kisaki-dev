import { membershipChangeSchema } from './membership'
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
  type ExternalLink,
  type ExternalIdentity,
  type AnimeEpisodeType,
  type AnimeExtraType,
  type PartType,
  type EntryRef,
  type PartWorkType,
  type PartRef,
} from './catalog'
import { DesktopError } from '../errors'

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

export type PartCreate<T extends PartType = PartType> = {
  [K in T]: {
    readonly type: K
    readonly work: EntryRef<PartWorkType<K>>
    readonly data: PartCreateFields<K>
    readonly completed?: boolean
    readonly prepared?: readonly PreparedAttachment[]
  }
}[T]

export type PartUpdate<T extends PartType = PartType> = {
  [K in T]: {
    readonly ref: PartRef<K>
    readonly changes: Partial<PartFields<K>>
    readonly expected?: Partial<PartFields<K>>
    readonly prepared?: readonly PreparedAttachment[]
  }
}[T]

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

export type PartKindTarget =
  | {
      readonly kind: 'animeEpisode'
      readonly type: AnimeEpisodeType | null
      readonly numberLabel: string | null
    }
  | { readonly kind: 'animeExtra'; readonly type: AnimeExtraType | null }

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

export interface PartsApi {
  list<Q extends PartQuery>(
    query: Q,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<PartDetails<Q['partType']>>>

  get<T extends PartType>(ref: PartRef<T>, call?: CallOptions): Promise<PartDetails<T> | null>

  create<I extends PartCreate>(input: I, call?: CallOptions): Promise<PartRef<I['type']>>

  update(
    ...args: {
      [K in PartType]: [ref: PartRef<K>, input: Omit<PartUpdate<K>, 'ref'>, call?: CallOptions]
    }[PartType]
  ): Promise<void>

  delete(refs: PartRef | NonEmptyArray<PartRef>, call?: CallOptions): Promise<void>

  merge<
    I extends {
      [K in PartType]: { readonly source: PartRef<K>; readonly target: PartRef<K> }
    }[PartType],
  >(
    input: I,
    call?: CallOptions,
  ): Promise<I['target']>

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

  reorder(scope: PartOrderScope, input: ReorderInput, call?: CallOptions): Promise<void>

  move(scope: PartOrderScope, input: MoveInput, call?: CallOptions): Promise<void>

  setCompleted(ref: PartRef, completed: boolean, call?: CallOptions): Promise<void>

  setCompletedMany(
    refs: NonEmptyArray<PartRef>,
    completed: boolean,
    call?: CallOptions,
  ): Promise<void>

  readonly volumeChapters: VolumeChaptersApi
}

export type PartOrderScope = {
  [K in PartType]: { readonly work: EntryRef<PartWorkType<K>>; readonly partType: K }
}[PartType]

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
  aliases: aliasesSchema,

  description: v.nullable(text),
  primaryImageId: v.nullable(id),

  externalLinks: externalLinksSchema,
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

export function parseVolumeChapterChange(input: unknown): VolumeChapterChange {
  const ref = v.strictObject({ type: v.literal('comicChapter'), id })
  const member = v.strictObject({ chapter: ref, numberLabel: v.nullable(text) })
  return parseValue(
    membershipChangeSchema(
      member,
      ref,
      (item) => item.chapter,
      (chapter) => chapter.id,
    ),
    input,
    'Invalid volume chapter membership',
  )
}
