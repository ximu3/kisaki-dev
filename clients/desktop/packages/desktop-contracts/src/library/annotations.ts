/** @fileoverview Defines saved content annotations, bounded summaries and atomic edits of complete content targets. */

import * as v from 'valibot'
import { DesktopError } from '../errors'
import type { ListOptions, ListResult, NonEmptyArray, CallOptions } from '../operations'
import type { PreparedAttachment } from '../resources'
import { id, optionalFields, parseValue, text, unique, validateExpectedKeys } from '../validation'
import { preparedSchema, workRefSchema, workTypes } from './catalog'
import type { EntryRef, WorkRef, WorkType } from './catalog'
import { parsePlaybackAnnotationLocation, parseReadingAnnotationLocation } from './reading'
import type {
  PlaybackAnnotationLocation,
  ReadingAnnotationLocation,
  ReadingPageRef,
} from './reading'

/** An annotation's table-qualified identity, independent of its file's continued existence. */
export interface AnnotationRef<T extends WorkType = WorkType> {
  readonly workType: T
  readonly id: string
}

/** Saved targets may lose a file reference through explicit file-record deletion while retaining historical content. */
export interface AnnotationTargetByType {
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

type WorkId<K extends WorkType> = { readonly [P in `${K}Id`]: string }

type NewTarget<K extends WorkType> = K extends 'game'
  ? AnnotationTargetByType[K]
  : Omit<AnnotationTargetByType[K], 'fileId'> & { readonly fileId: string }

/** Game annotations are actual captured images; the other media carry their own mandatory location form. */
export type Annotation = {
  [K in WorkType]: {
    readonly workType: K
    readonly id: string
    readonly title: string | null
    readonly content: string
    readonly createdAt: number
    readonly updatedAt: number
  } & WorkId<K> &
    AnnotationTargetByType[K]
}[WorkType]

/** Creating an annotation always requires a complete actual target; title and content may be empty. */
export type AnnotationCreate = {
  [K in WorkType]: {
    readonly workType: K
    readonly title?: string | null
    readonly content?: string
    readonly prepared?: readonly PreparedAttachment[]
    readonly target: NewTarget<K>
  } & WorkId<K>
}[WorkType]

/** Target is one save unit. Titles and body edits neither reopen media nor compare unrelated target state. */
export interface AnnotationUpdate<K extends WorkType = WorkType> {
  readonly changes: {
    readonly title?: string | null
    readonly content?: string
    readonly target?: AnnotationTargetByType[K]
  }
  readonly expected?: {
    readonly title?: string | null
    readonly content?: string
    readonly target?: AnnotationTargetByType[K]
  }
  readonly prepared?: readonly PreparedAttachment[]
}

export type AnnotationScope =
  | { readonly type: 'library' }
  | { readonly type: 'work'; readonly work: WorkRef }
  | {
      readonly type: 'file'
      readonly work: EntryRef<'anime' | 'comic' | 'novel'>
      readonly fileId: string
    }

/** Optional arrays distinguish omission from an explicit empty result. All constraints intersect ordinary visibility. */
export interface AnnotationQuery {
  readonly scope: AnnotationScope
  readonly search: string
  readonly workTypes?: readonly WorkType[]
  readonly refs?: readonly AnnotationRef[]
}

export type AnnotationPositionHint =
  | { readonly type: 'video'; readonly startSeconds: number; readonly endSeconds: number | null }
  | { readonly type: 'page'; readonly page: ReadingPageRef }

/** Excerpts are at most 160 UTF-16 units, ending on complete extended grapheme boundaries; no full body or geometry. */
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

/** Lightweight original locations for a live file's content-order index, without saved text or images. */
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

/** Reads and writes own saved facts. Returning to content is a sessions operation, not a side effect of get. */
export interface AnnotationsApi {
  list(
    query: AnnotationQuery,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<AnnotationSummary>>
  get(ref: AnnotationRef, call?: CallOptions): Promise<Annotation | null>
  listLocations(
    scope: { readonly work: EntryRef<'anime' | 'comic' | 'novel'>; readonly fileId: string },
    options: ListOptions,
    call?: CallOptions,
  ): Promise<AnnotationLocationResult>

  create(input: AnnotationCreate, call?: CallOptions): Promise<string>
  update(
    ...args: {
      [K in WorkType]: [ref: AnnotationRef<K>, input: AnnotationUpdate<K>, call?: CallOptions]
    }[WorkType]
  ): Promise<void>
  delete(refs: AnnotationRef | NonEmptyArray<AnnotationRef>, call?: CallOptions): Promise<void>
}

export const annotationRefSchema = v.strictObject({ workType: v.picklist(workTypes), id })

export const nullableTitleSchema = v.pipe(
  v.nullable(text),
  v.transform((value) => value?.trim() || null),
)

const readingLocation = v.pipe(v.unknown(), v.transform(parseReadingAnnotationLocation))
const playbackLocation = v.pipe(v.unknown(), v.transform(parsePlaybackAnnotationLocation))

const targetEntries = {
  game: { imageId: id },
  anime: { fileId: v.nullable(id), location: playbackLocation, imageId: v.nullable(id) },

  comic: {
    fileId: v.nullable(id),
    location: readingLocation,
    quote: v.nullable(text),
    imageId: v.nullable(id),
  },

  novel: {
    fileId: v.nullable(id),
    location: readingLocation,
    quote: v.nullable(text),
    imageId: v.nullable(id),
  },
}

const targetSchemas = {
  game: v.strictObject(targetEntries.game),
  anime: v.strictObject(targetEntries.anime),
  comic: v.strictObject(targetEntries.comic),
  novel: v.strictObject(targetEntries.novel),
}

/** Parse an annotation reference without performing visibility or existence checks. */
export function parseAnnotationRef(input: unknown): AnnotationRef {
  return parseValue(annotationRefSchema, input, 'Invalid annotation reference')
}

/** Validate a precise query; duplicate identities are invalid and empty arrays stay empty. */
export function parseAnnotationQuery(input: unknown): AnnotationQuery {
  return parseValue(
    v.strictObject({
      scope: v.variant('type', [
        v.strictObject({ type: v.literal('library') }),
        v.strictObject({ type: v.literal('work'), work: workRefSchema }),
        v.strictObject({
          type: v.literal('file'),
          work: v.strictObject({ type: v.picklist(['anime', 'comic', 'novel']), id }),
          fileId: id,
        }),
      ]),
      search: text,
      workTypes: v.exactOptional(
        v.pipe(
          v.array(v.picklist(workTypes)),
          v.check((types) => unique(types, (type) => type)),
        ),
      ),
      refs: v.exactOptional(
        v.pipe(
          v.array(annotationRefSchema),
          v.check((refs) => unique(refs, (ref) => JSON.stringify([ref.workType, ref.id]))),
        ),
      ),
    }),
    input,
    'Invalid annotation query',
  )
}

/** Validate the medium's complete new target; actual ownership, prepared holds and attachment availability stay host checks. */
export function parseAnnotationCreate(input: unknown): AnnotationCreate {
  const common = {
    title: v.exactOptional(nullableTitleSchema),
    content: v.exactOptional(text),
    prepared: v.exactOptional(v.array(preparedSchema)),
  }
  return parseValue(
    v.variant('workType', [
      v.strictObject({
        workType: v.literal('game'),
        gameId: id,
        ...common,
        target: targetSchemas.game,
      }),
      v.strictObject({
        workType: v.literal('anime'),
        animeId: id,
        ...common,
        target: v.strictObject({ ...targetEntries.anime, fileId: id }),
      }),
      v.strictObject({
        workType: v.literal('comic'),
        comicId: id,
        ...common,
        target: v.strictObject({ ...targetEntries.comic, fileId: id }),
      }),
      v.strictObject({
        workType: v.literal('novel'),
        novelId: id,
        ...common,
        target: v.strictObject({ ...targetEntries.novel, fileId: id }),
      }),
    ]),
    input,
    'Invalid annotation creation',
  )
}

/** Parse an atomic target replacement and reject unrelated expected fields or a known nonnull-to-null file detachment. */
export function parseAnnotationUpdate(ref: AnnotationRef, input: unknown): AnnotationUpdate {
  const type = parseAnnotationRef(ref).workType
  const fields = v.strictObject(
    optionalFields({ title: nullableTitleSchema, content: text, target: targetSchemas[type] }),
  )
  const value = parseValue(
    v.strictObject({
      changes: fields,
      expected: v.exactOptional(fields),
      prepared: v.exactOptional(v.array(preparedSchema)),
    }),
    input,
    'Invalid annotation edit',
  )
  validateExpectedKeys(value.changes, value.expected)
  if (
    value.changes.target &&
    'fileId' in value.changes.target &&
    value.changes.target.fileId === null &&
    value.expected?.target &&
    'fileId' in value.expected.target &&
    value.expected.target.fileId !== null
  ) {
    throw new DesktopError(
      'InvalidInput',
      'An annotation edit cannot detach an existing file reference',
    )
  }

  return value
}
