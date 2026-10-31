/** @fileoverview Defines real catalog parts, their editable fields, classifications, and kind correction. */

import * as v from 'valibot'
import { objectSchema } from '../schema'
import { partialDateSchema, type PartialDate } from '../date'
import type { CallOptions, ListOptions, ListResult } from '../execution'
import { preparedAttachmentSchema, type PreparedAttachment } from '../resources'
import {
  exactPartialEntries,
  hasRelatedExpected,
  nonemptyStringSchema,
  nonnegativeIntegerSchema,
  parseContract,
  type FieldSchemas,
} from '../validation'
import { commonEntryFields, externalIdentitiesSchema, type ExternalLink } from './catalog'
import type { EntryRef, ExternalIdentity, PartRef, PartType } from './identity'
import type { MoveInput, OrderChange } from './ordering'

/** Anime classifications describe catalog content, never its file coverage or completion policy. */
export const animeEpisodeTypes = ['regular', 'special'] as const
export const animeExtraTypes = ['opening', 'ending', 'promotion', 'interview', 'other'] as const
export type AnimeEpisodeType = (typeof animeEpisodeTypes)[number]
export type AnimeExtraType = (typeof animeExtraTypes)[number]
/** Every part has exactly one work of the corresponding kind. */
export type PartWorkType<Type extends PartType> = Type extends 'animeEpisode' | 'animeExtra'
  ? 'anime'
  : Type extends 'novelVolume'
    ? 'novel'
    : 'comic'

export const commonPartFields = {
  name: v.nullable(nonemptyStringSchema),
  originalName: commonEntryFields.originalName,
  aliases: commonEntryFields.aliases,
  description: commonEntryFields.description,
  primaryImageId: commonEntryFields.primaryImageId,
  externalLinks: commonEntryFields.externalLinks,
  releaseDate: v.nullable(partialDateSchema),
  externalIdentities: externalIdentitiesSchema,
}
const count = v.nullable(nonnegativeIntegerSchema)
const numberLabel = v.nullable(nonemptyStringSchema)
export const partMetadataFields = {
  novelVolume: { ...commonPartFields, numberLabel, declaredPageCount: count },
  comicVolume: {
    ...commonPartFields,
    numberLabel,
    declaredPageCount: count,
    declaredChapterCount: count,
  },
  comicChapter: { ...commonPartFields, numberLabel, declaredPageCount: count },
  animeEpisode: {
    ...commonPartFields,
    numberLabel,
    type: v.nullable(v.picklist(animeEpisodeTypes)),
    declaredDurationMs: count,
  },
  animeExtra: {
    ...commonPartFields,
    type: v.nullable(v.picklist(animeExtraTypes)),
    declaredDurationMs: count,
  },
} satisfies { [Type in PartType]: FieldSchemas<PartMetadataByType[Type]> }

/** Catalog part metadata never duplicates an entry's evaluation, sensitivity, or added date. */
export interface CommonPartMetadata {
  readonly name: string | null
  readonly originalName: string | null
  readonly aliases: readonly string[]
  readonly description: string | null
  readonly primaryImageId: string | null
  readonly externalLinks: readonly ExternalLink[]
  readonly releaseDate: PartialDate | null
  readonly externalIdentities: readonly ExternalIdentity[]
}
/** Real fields of each part kind; anime classification is distinct from PartRef.type. */
export interface PartMetadataByType {
  readonly novelVolume: CommonPartMetadata & {
    readonly numberLabel: string | null
    readonly declaredPageCount: number | null
  }
  readonly comicVolume: CommonPartMetadata & {
    readonly numberLabel: string | null
    readonly declaredPageCount: number | null
    readonly declaredChapterCount: number | null
  }
  readonly comicChapter: CommonPartMetadata & {
    readonly numberLabel: string | null
    readonly declaredPageCount: number | null
  }
  readonly animeEpisode: CommonPartMetadata & {
    readonly numberLabel: string | null
    readonly type: AnimeEpisodeType | null
    readonly declaredDurationMs: number | null
  }
  readonly animeExtra: CommonPartMetadata & {
    readonly type: AnimeExtraType | null
    readonly declaredDurationMs: number | null
  }
}
/** Explicitly writable part metadata, independent of read summaries or technical order fields. */
export type PartCreateFields<Type extends PartType = PartType> = Partial<PartMetadataByType[Type]>
/** One complete part snapshot; its ref.type is independent of anime data.type classification. */
export type PartDetails<Type extends PartType = PartType> = {
  [Kind in Type]: {
    readonly ref: PartRef<Kind>
    readonly work: EntryRef<PartWorkType<Kind>>
    readonly data: PartMetadataByType[Kind]
    readonly completed: boolean
    readonly sortOrder: number
    readonly createdAt: number
    readonly updatedAt: number
  }
}[Type]

const animeWork = objectSchema({ type: v.literal('anime'), id: nonemptyStringSchema })
const comicWork = objectSchema({ type: v.literal('comic'), id: nonemptyStringSchema })
const novelWork = objectSchema({ type: v.literal('novel'), id: nonemptyStringSchema })
const creationExtras = {
  completed: v.exactOptional(v.boolean()),
  prepared: v.exactOptional(v.pipe(v.array(preparedAttachmentSchema), v.readonly())),
}
export const partCreateSchemas = {
  novelVolume: objectSchema({
    type: v.literal('novelVolume'),
    work: novelWork,
    data: objectSchema(exactPartialEntries(partMetadataFields.novelVolume)),
    ...creationExtras,
  }),
  comicVolume: objectSchema({
    type: v.literal('comicVolume'),
    work: comicWork,
    data: objectSchema(exactPartialEntries(partMetadataFields.comicVolume)),
    ...creationExtras,
  }),
  comicChapter: objectSchema({
    type: v.literal('comicChapter'),
    work: comicWork,
    data: objectSchema(exactPartialEntries(partMetadataFields.comicChapter)),
    ...creationExtras,
  }),
  animeEpisode: objectSchema({
    type: v.literal('animeEpisode'),
    work: animeWork,
    data: objectSchema(exactPartialEntries(partMetadataFields.animeEpisode)),
    ...creationExtras,
  }),
  animeExtra: objectSchema({
    type: v.literal('animeExtra'),
    work: animeWork,
    data: objectSchema(exactPartialEntries(partMetadataFields.animeExtra)),
    ...creationExtras,
  }),
}

/** Creation explicitly identifies the kind and parent; it never fabricates a title or a placeholder part. */
export type PartCreateInput<Type extends PartType = PartType> = {
  [Kind in Type]: {
    readonly type: Kind
    readonly work: EntryRef<PartWorkType<Kind>>
    readonly data: PartCreateFields<Kind>
    readonly completed?: boolean
    readonly prepared?: readonly PreparedAttachment[]
  }
}[Type]
/** Only actual metadata fields are editable; completion and kind correction have explicit operations. */
export interface PartUpdateInput<Type extends PartType = PartType> {
  readonly changes: PartCreateFields<Type>
  readonly expected?: PartCreateFields<Type>
  readonly prepared?: readonly PreparedAttachment[]
}
/** A graph/batch update refers to an existing part and preserves target-kind correlation. */
export type PartUpdate = {
  [Type in PartType]: { readonly ref: PartRef<Type> } & PartUpdateInput<Type>
}[PartType]
/** One actual work-side part sequence; comic volumes and chapters retain separate orders. */
export type PartScope = {
  [Type in PartType]: { readonly type: Type; readonly work: EntryRef<PartWorkType<Type>> }
}[PartType]

/** Anime content keeps its ID through a correction; episode numbers exist only in the episode branch. */
export type AnimePartTarget =
  | {
      readonly kind: 'animeEpisode'
      readonly type: AnimeEpisodeType | null
      readonly numberLabel: string | null
    }
  | { readonly kind: 'animeExtra'; readonly type: AnimeExtraType | null }
/** Changes and removed fields compare against the original part kind, not the target kind. */
export interface PartKindChangeInput<
  Type extends 'animeEpisode' | 'animeExtra' = 'animeEpisode' | 'animeExtra',
> {
  readonly target: Type extends 'animeEpisode'
    ? Extract<AnimePartTarget, { kind: 'animeExtra' }>
    : Extract<AnimePartTarget, { kind: 'animeEpisode' }>
  readonly changes: Partial<CommonPartMetadata & { readonly declaredDurationMs: number | null }>
  readonly expected?: PartCreateFields<Type>
  readonly prepared?: readonly PreparedAttachment[]
}
const correctionFields = objectSchema(
  exactPartialEntries({ ...commonPartFields, declaredDurationMs: count }),
)
const kindChangeSchemas: {
  [Type in 'animeEpisode' | 'animeExtra']: v.GenericSchema<unknown, PartKindChangeInput<Type>>
} = {
  animeEpisode: kindChangeSchema(
    objectSchema({ kind: v.literal('animeExtra'), type: v.nullable(v.picklist(animeExtraTypes)) }),
    partMetadataFields.animeEpisode,
    ['type', 'numberLabel'],
  ),
  animeExtra: kindChangeSchema(
    objectSchema({
      kind: v.literal('animeEpisode'),
      type: v.nullable(v.picklist(animeEpisodeTypes)),
      numberLabel,
    }),
    partMetadataFields.animeExtra,
    ['type'],
  ),
}
export const partUpdateSchemas: {
  [Type in PartType]: v.GenericSchema<unknown, PartUpdateInput<Type>>
} = {
  novelVolume: partUpdateSchema(partMetadataFields.novelVolume),
  comicVolume: partUpdateSchema(partMetadataFields.comicVolume),
  comicChapter: partUpdateSchema(partMetadataFields.comicChapter),
  animeEpisode: partUpdateSchema(partMetadataFields.animeEpisode),
  animeExtra: partUpdateSchema(partMetadataFields.animeExtra),
}

/** Complete part operations; writes validate ownership and occupancy in the same short transaction. */
export interface PartsApi {
  /** Read a bounded sequence and its total from the same snapshot. */
  list(
    scope: PartScope,
    options: ListOptions & { readonly completed?: boolean },
    call?: CallOptions,
  ): Promise<ListResult<PartDetails>>
  /** Missing or ordinarily hidden parts return null. */
  get<Type extends PartType>(
    ref: PartRef<Type>,
    call?: CallOptions,
  ): Promise<PartDetails<Type> | null>
  /** Create all supplied metadata and the optional completion mark together. */
  create<Type extends PartType>(
    input: PartCreateInput<Type>,
    call?: CallOptions,
  ): Promise<PartRef<Type>>
  /** Preserve unmodified fields and reject unrelated or stale expected values. */
  update<Type extends PartType>(
    ref: PartRef<Type>,
    input: PartUpdateInput<NoInfer<Type>>,
    call?: CallOptions,
  ): Promise<void>
  /** Remove only the explicit part and its owned references; user files remain intact. */
  delete(ref: PartRef | readonly PartRef[], call?: CallOptions): Promise<void>
  /** Merge one same-kind, same-work duplicate into the explicitly retained target. */
  merge(
    input: { readonly source: PartRef; readonly target: PartRef },
    call?: CallOptions,
  ): Promise<PartRef>
  /** Correct one anime part kind while preserving its content identity and applicable references. */
  changeKind<Type extends 'animeEpisode' | 'animeExtra'>(
    ref: PartRef<Type>,
    input: PartKindChangeInput<NoInfer<Type>>,
    call?: CallOptions,
  ): Promise<PartRef<'animeEpisode' | 'animeExtra'>>
  /** Reorder this side against its complete baseline; subset changes preserve all other slots. */
  reorder(scope: PartScope, input: OrderChange, call?: CallOptions): Promise<void>
  /** Move current members before a real nonselected anchor, without a snapshot baseline. */
  move(scope: PartScope, input: MoveInput, call?: CallOptions): Promise<void>
  /** Set a part's current mark; this never adds a work completion record. */
  setCompleted(ref: PartRef, completed: boolean, call?: CallOptions): Promise<void>
  /** Set a nonempty unique set atomically; later-created parts are outside the request. */
  setCompletedMany(
    refs: readonly [PartRef, ...PartRef[]],
    completed: boolean,
    call?: CallOptions,
  ): Promise<void>
}

/** Parse the five complete creation branches and their exact work-kind pairing. */
export function parsePartCreate(input: unknown): PartCreateInput {
  return parseContract(v.union(Object.values(partCreateSchemas)), input, 'part creation')
}

/** Parse only editable fields for the target kind and reject unrelated independent baselines. */
export function parsePartUpdate<Type extends PartType>(
  type: Type,
  input: unknown,
): PartUpdateInput<Type> {
  return parseContract(partUpdateSchemas[type], input, 'part update')
}

function partUpdateSchema<Entries extends v.ObjectEntries>(entries: Entries) {
  const fields = objectSchema(exactPartialEntries(entries))
  return v.pipe(
    objectSchema({
      changes: fields,
      expected: v.exactOptional(fields),
      prepared: creationExtras.prepared,
    }),
    v.check(
      (value) => value.changes !== undefined && hasRelatedExpected(value.changes, value.expected),
    ),
  )
}

/** Parse correction of the same content to the other anime kind, including removed-field baselines. */
export function parsePartKindChange<Type extends 'animeEpisode' | 'animeExtra'>(
  type: Type,
  input: unknown,
): PartKindChangeInput<Type> {
  return parseContract(kindChangeSchemas[type], input, 'part kind correction')
}

function kindChangeSchema<Target extends v.GenericSchema, Entries extends v.ObjectEntries>(
  target: Target,
  entries: Entries,
  removed: readonly string[],
) {
  return v.pipe(
    objectSchema({
      target,
      changes: correctionFields,
      expected: v.exactOptional(objectSchema(exactPartialEntries(entries))),
      prepared: creationExtras.prepared,
    }),
    v.check(
      (value) =>
        value.changes !== undefined && hasRelatedExpected(value.changes, value.expected, removed),
    ),
  )
}
