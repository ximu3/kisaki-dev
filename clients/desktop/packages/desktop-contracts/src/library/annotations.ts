/** @fileoverview Defines saved content annotations, bounded summaries and atomic edits of complete content targets. */

import type { WorkType, WorkRef, EntryRef } from './catalog'
import type {
  PlaybackAnnotationLocation,
  ReadingAnnotationLocation,
  ReadingPageRef,
} from './reading'
import type { PreparedAttachment } from '../resources'
import type { ListOptions, CallOptions, ListResult, NonEmptyArray } from '../operations'
import * as v from 'valibot'
import { workTypes, workRefSchema, preparedSchema } from './catalog'
import { id, text, parseValue, unique, optionalFields, validateExpectedKeys } from '../validation'
import { parseReadingAnnotationLocation, parsePlaybackAnnotationLocation } from './reading'
import { DesktopError } from '../errors'

/** An annotation's table-qualified identity, independent of its file's continued existence. */
export interface AnnotationRef<T extends WorkType = WorkType> {
  readonly workType: T
  readonly id: string
}

/**
 * Saved media-specific annotation targets and retained content.
 *
 * Explicit file-record deletion may clear the file reference while preserving historical content.
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

/** The owning work's type-specific identity field. */
type WorkId<K extends WorkType> = { readonly [P in `${K}Id`]: string }

/** A complete new annotation target with a live file identity for file-based media. */
type NewTarget<K extends WorkType> = K extends 'game'
  ? AnnotationTargetByType[K]
  : Omit<AnnotationTargetByType[K], 'fileId'> & { readonly fileId: string }

/**
 * A saved annotation with its work identity, content and media-specific target.
 *
 * Game annotations retain captured images; other media require their corresponding location form.
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
 * New annotation content and a complete actual target.
 *
 * Title and body may be empty; prepared attachments support content adoption in the same save.
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
 * Annotation field changes with optional expected values and prepared content.
 *
 * The complete target is one save unit. Title and body edits do not reopen media or compare
 * unrelated target state.
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

/** The library, work or file boundary for annotation queries. */
export type AnnotationScope =
  | { readonly type: 'library' }
  | { readonly type: 'work'; readonly work: WorkRef }
  | {
      readonly type: 'file'
      readonly work: EntryRef<'anime' | 'comic' | 'novel'>
      readonly fileId: string
    }

/**
 * Annotation scope, search and optional identity or work-type constraints.
 *
 * Constraints intersect ordinary visibility. Omitted arrays add no restriction; explicit empty
 * arrays produce no matches.
 */
export interface AnnotationQuery {
  readonly scope: AnnotationScope
  readonly search: string
  readonly workTypes?: readonly WorkType[]
  readonly refs?: readonly AnnotationRef[]
}

/** A lightweight video-time or reading-page hint for annotation summaries. */
export type AnnotationPositionHint =
  | { readonly type: 'video'; readonly startSeconds: number; readonly endSeconds: number | null }
  | { readonly type: 'page'; readonly page: ReadingPageRef }

/**
 * Lightweight annotation identity, display content and location hints.
 *
 * Excerpts contain at most 160 UTF-16 code units and end at complete extended grapheme boundaries.
 * Full bodies and geometry are read separately.
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

/** A page of original annotation locations and the total matching count. */
export interface AnnotationLocationResult<
  T extends 'anime' | 'comic' | 'novel' = 'anime' | 'comic' | 'novel',
> {
  readonly items: readonly AnnotationLocationItem<T>[]
  readonly total: number
}

/**
 * Saved annotation queries and atomic content edits.
 *
 * Returning to content belongs to sessions and is not a side effect of reading annotations.
 */
export interface AnnotationsApi {
  /** Lists lightweight annotation summaries within the requested saved-fact scope. */
  list(
    query: AnnotationQuery,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<AnnotationSummary>>

  /**
   * Reads a complete saved annotation, or null when it is absent, without changing a content
   * session.
   */
  get<T extends WorkType>(ref: AnnotationRef<T>, call?: CallOptions): Promise<Annotation<T> | null>

  /**
   * Lists original locations for one file's content-order index.
   *
   * Results exclude saved text, images and unrelated files.
   */
  listLocations<T extends 'anime' | 'comic' | 'novel'>(
    scope: { readonly work: EntryRef<T>; readonly fileId: string },
    options: ListOptions,
    call?: CallOptions,
  ): Promise<AnnotationLocationResult<T>>

  /**
   * Commits an annotation, its exact location and adopted content together.
   *
   * Optional evidence remains separate from source identity.
   */
  create(input: AnnotationCreate, call?: CallOptions): Promise<string>

  /**
   * Compares and commits the submitted annotation fields and related content.
   *
   * Saved locations are not reinterpreted against different bytes.
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

/** Stable annotation identity qualified by its owning work medium. */
export const annotationRefSchema = v.strictObject({ workType: v.picklist(workTypes), id })

/** Optional annotation title with blank input normalized to an absent title. */
export const nullableTitleSchema = v.pipe(
  v.nullable(text),
  v.transform((value) => value?.trim() || null),
)

/** Validated source location used by comic and novel annotations. */
const readingLocation = v.pipe(v.unknown(), v.transform(parseReadingAnnotationLocation))

/** Validated file-local video position or range used by anime annotations. */
const playbackLocation = v.pipe(v.unknown(), v.transform(parsePlaybackAnnotationLocation))

/** Annotation-target fields owned by each medium, including its image and location requirements. */
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

/** Complete per-medium annotation target validators used by explicit target changes. */
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

/**
 * Parses a complete new media-specific annotation target.
 *
 * The host separately checks ownership, prepared holds and attachment availability.
 */
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
 * Parses annotation changes and expected values for the same save units.
 *
 * Rejects a known transition from a nonnull file reference to null; current-state checks remain
 * with the write owner.
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
