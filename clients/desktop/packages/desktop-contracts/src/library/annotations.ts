import type { PreparedAttachment } from '../resources'
import type { ListOptions, CallOptions, ListResult, NonEmptyArray } from '../operations'
import * as v from 'valibot'
import {
  workTypes,
  workRefSchema,
  preparedSchema,
  type WorkType,
  type WorkRef,
  type EntryRef,
} from './catalog'
import {
  fromParser,
  id,
  text,
  parseValue,
  unique,
  optionalFields,
  validateExpectedKeys,
} from '../validation'
import {
  parseReadingAnnotationLocation,
  parsePlaybackAnnotationLocation,
  type PlaybackAnnotationLocation,
  type ReadingAnnotationLocation,
  type ReadingPageRef,
} from './reading'
import { DesktopError } from '../errors'

/** An annotation's table-qualified identity, independent of its file's continued existence. */
export interface AnnotationRef<T extends WorkType = WorkType> {
  readonly workType: T
  readonly id: string
}

/**
 * Explicit file-record deletion may clear the file reference while preserving saved annotation
 * content.
 */
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

/**
 * Game annotations retain captured images. Other media require their corresponding location form.
 */
export type Annotation<T extends WorkType = WorkType> = {
  [K in T]: {
    readonly workType: K
    readonly id: string
    readonly title: string | null
    readonly content: string
    /** UTC milliseconds since the Unix epoch. */
    readonly createdAt: number
    /** UTC milliseconds since the Unix epoch. */
    readonly updatedAt: number
  } & WorkId<K> &
    AnnotationTargetByType[K]
}[T]

/**
 * Title and body may be empty. Prepared attachments can be adopted in the same save.
 */
export type AnnotationCreate = {
  [K in WorkType]: {
    readonly workType: K
    readonly title?: string | null
    readonly content?: string
    readonly prepared?: readonly PreparedAttachment[]
    readonly target: NewTarget<K>
  } & WorkId<K>
}[WorkType]

/**
 * The complete target is one save unit. Editing title or body compares only submitted fields and
 * leaves the media closed.
 */
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

/**
 * Constraints intersect ordinary visibility. Omitted arrays add no restriction. Empty arrays
 * produce no matches.
 */
export interface AnnotationQuery {
  readonly scope: AnnotationScope
  readonly search: string
  readonly workTypes?: readonly WorkType[]
  readonly refs?: readonly AnnotationRef[]
}

export type AnnotationPositionHint =
  | { readonly type: 'video'; readonly startSeconds: number; readonly endSeconds: number | null }
  | { readonly type: 'page'; readonly page: ReadingPageRef }

/**
 * Excerpts stop at a complete extended grapheme boundary within 160 UTF-16 code units. Full bodies
 * and geometry have dedicated reads.
 */
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

  /** UTC milliseconds since the Unix epoch. */
  readonly createdAt: number
  /** UTC milliseconds since the Unix epoch. */
  readonly updatedAt: number
}

/** Lightweight original locations for a live file's content-order index, without saved text or images. */
export type AnnotationLocationItem<
  T extends 'anime' | 'comic' | 'novel' = 'anime' | 'comic' | 'novel',
> = {
  [K in T]: {
    readonly ref: AnnotationRef<K>
    readonly location: AnnotationTargetByType[K]['location']
    /** UTC milliseconds since the Unix epoch. */
    readonly createdAt: number
  }
}[T]

export interface AnnotationLocationResult<
  T extends 'anime' | 'comic' | 'novel' = 'anime' | 'comic' | 'novel',
> {
  readonly items: readonly AnnotationLocationItem<T>[]
  readonly total: number
}

/** A saved target can be opened through the session API. */
export interface AnnotationsApi {
  list(
    query: AnnotationQuery,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<AnnotationSummary>>

  /** Returns null when the annotation is absent. Reading leaves the current session unchanged. */
  get<T extends WorkType>(ref: AnnotationRef<T>, call?: CallOptions): Promise<Annotation<T> | null>

  /**
   * This index projects original locations from a single file. Read full annotations for saved text
   * and images.
   */
  listLocations<T extends 'anime' | 'comic' | 'novel'>(
    scope: { readonly work: EntryRef<T>; readonly fileId: string },
    options: ListOptions,
    call?: CallOptions,
  ): Promise<AnnotationLocationResult<T>>

  /**
   * The location and adopted content commit together. Optional evidence remains separate from
   * source identity.
   */
  create(input: AnnotationCreate, call?: CallOptions): Promise<string>

  /**
   * Compares submitted fields and preserves saved locations against the bytes they originally
   * addressed.
   */
  update(
    ...args: {
      [K in WorkType]: [ref: AnnotationRef<K>, input: AnnotationUpdate<K>, call?: CallOptions]
    }[WorkType]
  ): Promise<void>

  /**
   * Deletes selected annotations and their owned references while preserving underlying content.
   */
  delete(refs: AnnotationRef | NonEmptyArray<AnnotationRef>, call?: CallOptions): Promise<void>
}

export const annotationRefSchema = v.strictObject({ workType: v.picklist(workTypes), id })

/** Optional annotation title with blank input normalized to an absent title. */
export const nullableTitleSchema = v.pipe(
  v.nullable(text),
  v.transform((value) => value?.trim() || null),
)

const readingLocation = fromParser(parseReadingAnnotationLocation)

const playbackLocation = fromParser(parsePlaybackAnnotationLocation)

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

/** Parses a table-qualified annotation identity without checking visibility or existence. */
export function parseAnnotationRef(input: unknown): AnnotationRef {
  return parseValue(annotationRefSchema, input, 'Invalid annotation reference')
}

/**
 * Parses annotation query constraints, rejecting duplicate identities and preserving empty arrays.
 */
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

/** The host checks ownership, prepared holds and attachment availability. */
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

/**
 * Rejects a supplied transition from a nonnull file to null. The write owner checks current state.
 */
export function parseAnnotationUpdate<T extends WorkType>(
  ref: AnnotationRef<T>,
  input: unknown,
): AnnotationUpdate<T>

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
