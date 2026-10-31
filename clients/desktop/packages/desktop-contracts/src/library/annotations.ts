/** @fileoverview Defines kind-specific annotation targets, related edit baselines, and bounded read projections. */

import * as v from 'valibot'
import { objectSchema } from '../schema'
import type { CallOptions, ListOptions } from '../execution'
import { preparedAttachmentSchema, type PreparedAttachment } from '../resources'
import {
  exactPartialEntries,
  hasRelatedExpected,
  hasUniqueKeys,
  nonemptyStringSchema,
  parseContract,
} from '../validation'
import { workRefSchema, workTypes, type EntryRef, type WorkRef, type WorkType } from './identity'
import { playbackAnnotationLocationSchema, type PlaybackAnnotationLocation } from './playback'
import {
  readingAnnotationLocationSchema,
  type ReadingAnnotationLocation,
  type ReadingPageRef,
} from './reading'

/** Annotation identity belongs to its actual work-kind table; no synthetic global parent is implied. */
export interface AnnotationRef<Type extends WorkType = WorkType> {
  readonly workType: Type
  readonly id: string
}
/** Saved targets can outlive a deleted file record; game targets always retain an actual image. */
export interface AnnotationTargets {
  readonly game: { readonly imageId: string }
  readonly anime: {
    readonly fileId: string | null
    readonly location: PlaybackAnnotationLocation
    readonly imageId: string | null
  }
  readonly comic: {
    readonly fileId: string | null
    readonly location: ReadingAnnotationLocation
    readonly quote: string | null
    readonly imageId: string | null
  }
  readonly novel: {
    readonly fileId: string | null
    readonly location: ReadingAnnotationLocation
    readonly quote: string | null
    readonly imageId: string | null
  }
}

type WorkIdentityFields = {
  game: { readonly gameId: string }
  anime: { readonly animeId: string }
  comic: { readonly comicId: string }
  novel: { readonly novelId: string }
}
/** Complete saved content; nonexistent medium-specific fields are not returned as invented nulls. */
export type Annotation<Type extends WorkType = WorkType> = {
  [Kind in Type]: {
    readonly id: string
    readonly workType: Kind
    readonly title: string | null
    readonly content: string
    readonly createdAt: number
    readonly updatedAt: number
  } & WorkIdentityFields[Kind] &
    AnnotationTargets[Kind]
}[Type]

const titleSchema = v.pipe(
  v.nullable(v.string()),
  v.transform((value) => (value === null || value.trim() === '' ? null : value)),
)
const nullableId = v.nullable(nonemptyStringSchema)
const targetFields = {
  game: { imageId: nonemptyStringSchema },
  anime: { fileId: nullableId, location: playbackAnnotationLocationSchema, imageId: nullableId },
  comic: {
    fileId: nullableId,
    location: readingAnnotationLocationSchema,
    quote: v.nullable(v.string()),
    imageId: nullableId,
  },
  novel: {
    fileId: nullableId,
    location: readingAnnotationLocationSchema,
    quote: v.nullable(v.string()),
    imageId: nullableId,
  },
}
const readTargets = {
  game: objectSchema(targetFields.game),
  anime: objectSchema(targetFields.anime),
  comic: objectSchema(targetFields.comic),
  novel: objectSchema(targetFields.novel),
}
const newTargets = {
  game: readTargets.game,
  anime: objectSchema({ ...targetFields.anime, fileId: nonemptyStringSchema }),
  comic: objectSchema({ ...targetFields.comic, fileId: nonemptyStringSchema }),
  novel: objectSchema({ ...targetFields.novel, fileId: nonemptyStringSchema }),
}
const prepared = v.exactOptional(v.pipe(v.array(preparedAttachmentSchema), v.readonly()))
const creationFields = {
  title: v.exactOptional(titleSchema),
  content: v.exactOptional(v.string()),
  prepared,
}
const createSchemas = {
  game: objectSchema({
    ...creationFields,
    workType: v.literal('game'),
    gameId: nonemptyStringSchema,
    target: newTargets.game,
  }),
  anime: objectSchema({
    ...creationFields,
    workType: v.literal('anime'),
    animeId: nonemptyStringSchema,
    target: newTargets.anime,
  }),
  comic: objectSchema({
    ...creationFields,
    workType: v.literal('comic'),
    comicId: nonemptyStringSchema,
    target: newTargets.comic,
  }),
  novel: objectSchema({
    ...creationFields,
    workType: v.literal('novel'),
    novelId: nonemptyStringSchema,
    target: newTargets.novel,
  }),
}
const updateSchemas: { [Type in WorkType]: v.GenericSchema<unknown, AnnotationUpdate<Type>> } = {
  game: annotationUpdateSchema(readTargets.game),
  anime: annotationUpdateSchema(readTargets.anime),
  comic: annotationUpdateSchema(readTargets.comic),
  novel: annotationUpdateSchema(readTargets.novel),
}
/** Complete adopted content and optional comments; creation requires a real file for nongame media. */
export type AnnotationCreate = {
  [Type in WorkType]: {
    readonly workType: Type
    readonly title?: string | null
    readonly content?: string
    readonly prepared?: readonly PreparedAttachment[]
    readonly target: Type extends 'game'
      ? AnnotationTargets['game']
      : Omit<AnnotationTargets[Type], 'fileId'> & { readonly fileId: string }
  } & WorkIdentityFields[Type]
}[WorkType]
/** Whole-target replacement is one comparison unit. The owner rejects clearing a still-valid file ID. */
export interface AnnotationUpdate<Type extends WorkType = WorkType> {
  readonly changes: {
    readonly title?: string | null
    readonly content?: string
    readonly target?: AnnotationTargets[Type]
  }
  readonly expected?: {
    readonly title?: string | null
    readonly content?: string
    readonly target?: AnnotationTargets[Type]
  }
  readonly prepared?: readonly PreparedAttachment[]
}

/** The actual scope, intersected with ordinary visibility and any explicit kind/ref filters. */
export type AnnotationScope =
  | { readonly type: 'library' }
  | { readonly type: 'work'; readonly work: WorkRef }
  | {
      readonly type: 'file'
      readonly work: EntryRef<'anime' | 'comic' | 'novel'>
      readonly fileId: string
    }
export interface AnnotationQuery {
  readonly scope: AnnotationScope
  readonly search: string
  readonly workTypes?: readonly WorkType[]
  readonly refs?: readonly AnnotationRef[]
}
/** Position hints never open a file or invent a source chapter name. */
export type AnnotationPositionHint =
  | { readonly type: 'video'; readonly startSeconds: number; readonly endSeconds: number | null }
  | { readonly type: 'page'; readonly page: ReadingPageRef }
/** Text excerpts are at most 160 UTF-16 units and end at an extended grapheme boundary. */
export interface AnnotationSummary {
  readonly ref: AnnotationRef
  readonly work: WorkRef
  readonly fileId: string | null
  readonly title: string | null
  readonly quoteExcerpt: string | null
  readonly contentExcerpt: string | null
  readonly imageId: string | null
  readonly locationKind: 'image' | 'position' | 'range' | 'text' | 'region'
  readonly positionHint: AnnotationPositionHint | null
  readonly createdAt: number
  readonly updatedAt: number
}
export interface AnnotationListResult {
  readonly items: readonly AnnotationSummary[]
  readonly total: number
}
/** A light file-scoped position projection, separate from comments, quotes, and images. */
export type AnnotationLocationItem =
  | {
      readonly ref: AnnotationRef<'anime'>
      readonly location: PlaybackAnnotationLocation
      readonly createdAt: number
    }
  | {
      readonly ref: AnnotationRef<'comic' | 'novel'>
      readonly location: ReadingAnnotationLocation
      readonly createdAt: number
    }
export interface AnnotationLocationResult {
  readonly items: readonly AnnotationLocationItem[]
  readonly total: number
}

/** Annotation operations never reopen the source merely to save historical content. */
export interface AnnotationsApi {
  /** Read a bounded summary interval with a coherent total, ordered by creation then stable identity. */
  list(
    query: AnnotationQuery,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<AnnotationListResult>
  /** Read the saved complete content or null; this does not navigate or launch a session. */
  get<Type extends WorkType>(
    ref: AnnotationRef<Type>,
    call?: CallOptions,
  ): Promise<Annotation<Type> | null>
  /** Read light positions in one actual file for an executor-owned content-order index. */
  listLocations(
    scope: { readonly work: EntryRef<'anime' | 'comic' | 'novel'>; readonly fileId: string },
    options: ListOptions,
    call?: CallOptions,
  ): Promise<AnnotationLocationResult>
  /** Adopt a complete content target and any actually referenced prepared attachments atomically. */
  create(input: AnnotationCreate, call?: CallOptions): Promise<string>
  /** Compare changed comments and whole target independently; failure retains the caller's draft resources. */
  update<Type extends WorkType>(
    ref: AnnotationRef<Type>,
    input: AnnotationUpdate<NoInfer<Type>>,
    call?: CallOptions,
  ): Promise<void>
  /** Delete only the explicit nonempty unique set in one short transaction. */
  delete(
    refs: AnnotationRef | readonly [AnnotationRef, ...AnnotationRef[]],
    call?: CallOptions,
  ): Promise<void>
}

export const annotationRefSchema = objectSchema({
  workType: v.picklist(workTypes),
  id: nonemptyStringSchema,
})
/** Parse identity without confusing matching IDs in different work-kind tables. */
export function parseAnnotationRef(input: unknown): AnnotationRef {
  return parseContract(annotationRefSchema, input, 'annotation reference')
}
/** Parse the complete work-specific creation target and optional user text. */
export function parseAnnotationCreate(input: unknown): AnnotationCreate {
  return parseContract(v.union(Object.values(createSchemas)), input, 'annotation creation')
}
/** Parse related baselines and a complete target; current file ownership remains a transaction check. */
export function parseAnnotationUpdate<Type extends WorkType>(
  type: Type,
  input: unknown,
): AnnotationUpdate<Type> {
  return parseContract(updateSchemas[type], input, 'annotation update')
}
/** Parse scope and unique filters; explicit empty filter arrays retain their empty-result meaning. */
export function parseAnnotationQuery(input: unknown): AnnotationQuery {
  return parseContract(
    objectSchema({
      scope: v.union([
        objectSchema({ type: v.literal('library') }),
        objectSchema({ type: v.literal('work'), work: workRefSchema }),
        objectSchema({
          type: v.literal('file'),
          work: objectSchema({
            type: v.picklist(['anime', 'comic', 'novel']),
            id: nonemptyStringSchema,
          }),
          fileId: nonemptyStringSchema,
        }),
      ]),
      search: v.string(),
      workTypes: v.exactOptional(
        v.pipe(
          v.array(v.picklist(workTypes)),
          v.check((values) => new Set(values).size === values.length),
          v.readonly(),
        ),
      ),
      refs: v.exactOptional(
        v.pipe(
          v.array(annotationRefSchema),
          v.check((values) =>
            hasUniqueKeys(values, (value) => JSON.stringify([value.workType, value.id])),
          ),
          v.readonly(),
        ),
      ),
    }),
    input,
    'annotation query',
  )
}

function annotationUpdateSchema<Target extends object>(target: v.GenericSchema<unknown, Target>) {
  const fields = objectSchema(
    exactPartialEntries({ title: titleSchema, content: v.string(), target }),
  )
  return v.pipe(
    objectSchema({ changes: fields, expected: v.exactOptional(fields), prepared }),
    v.check(
      (value) => value.changes !== undefined && hasRelatedExpected(value.changes, value.expected),
    ),
  )
}
