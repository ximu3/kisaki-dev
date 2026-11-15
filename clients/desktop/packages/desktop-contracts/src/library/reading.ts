/** @fileoverview Owns persistent reading coordinates, selections and video locations without importing a content engine. */

import type { NormalizedPoint, NormalizedQuad, NormalizedRect } from '../geometry'
import type { NonEmptyArray } from '../operations'
import * as v from 'valibot'
import {
  nonemptyText,
  nonnegativeInteger,
  parseValue,
  unique,
  nonnegativeNumber,
} from '../validation'
import { parseCfiPoint } from './cfi'
import { parseNormalizedPoint, parseNormalizedQuad, parseNormalizedRect } from '../geometry'
import { DesktopError } from '../errors'

/** Canonical lowercase WHATWG encoding names, excluding the non-content replacement decoder. */
export const textEncodings = Object.freeze([
  'utf-8',
  'ibm866',
  'iso-8859-2',
  'iso-8859-3',
  'iso-8859-4',
  'iso-8859-5',
  'iso-8859-6',
  'iso-8859-7',
  'iso-8859-8',
  'iso-8859-8-i',
  'iso-8859-10',
  'iso-8859-13',
  'iso-8859-14',
  'iso-8859-15',
  'iso-8859-16',
  'koi8-r',
  'koi8-u',
  'macintosh',
  'windows-874',
  'windows-1250',
  'windows-1251',
  'windows-1252',
  'windows-1253',
  'windows-1254',
  'windows-1255',
  'windows-1256',
  'windows-1257',
  'windows-1258',
  'x-mac-cyrillic',
  'gbk',
  'gb18030',
  'big5',
  'euc-jp',
  'iso-2022-jp',
  'shift_jis',
  'euc-kr',
  'utf-16be',
  'utf-16le',
  'x-user-defined',
] as const)

/** Canonical lowercase WHATWG encoding name supported for persisted text coordinates. */
export type TextEncoding = (typeof textEncodings)[number]

/**
 * Source coordinate shape for each supported reading anchor kind.
 *
 * Text offsets count UTF-16 units. Byte offsets address the format's original reconstructed
 * content.
 */
export interface ReadingAnchorByType {
  readonly epubCfi: { readonly type: 'epubCfi'; readonly value: string }

  readonly textOffset: {
    readonly type: 'textOffset'
    readonly encoding: TextEncoding
    readonly offset: number
  }

  readonly xmlNode: {
    readonly type: 'xmlNode'
    readonly nodePath: readonly number[]
    readonly textOffset?: number
  }

  readonly mobi: {
    readonly type: 'mobi'
    readonly byteOffset: number
    readonly textOffset?: number
  }

  readonly kf8: {
    readonly type: 'kf8'
    readonly documentIndex: number
    readonly byteOffset: number
    readonly textOffset?: number
  }
}

/** Persistent address within a supported source text coordinate system. */
export type ReadingAnchor = ReadingAnchorByType[keyof ReadingAnchorByType]

/**
 * Original page identity independent of the rendered page number.
 *
 * Member paths preserve source case and Unicode.
 */
export type ReadingPageRef =
  | { readonly type: 'pageIndex'; readonly index: number }
  | { readonly type: 'memberPath'; readonly path: string }
  | { readonly type: 'epubSpineItem'; readonly index: number }
  | { readonly type: 'kf8Document'; readonly index: number }

/** Persistent reading location expressed as a source anchor or a point on an original page. */
export type ReadingPosition =
  | { readonly type: 'anchor'; readonly anchor: ReadingAnchor }
  | { readonly type: 'page'; readonly page: ReadingPageRef; readonly point: NormalizedPoint }

/**
 * Continuous nonempty text selection expressed as matching source anchors or ordered page quads.
 *
 * Source interpretation verifies order, path continuity and surrogate boundaries.
 */
export type ReadingTextSelection =
  | {
      [K in keyof ReadingAnchorByType]: {
        readonly type: 'anchors'
        readonly start: ReadingAnchorByType[K]
        readonly end: ReadingAnchorByType[K]
      }
    }[keyof ReadingAnchorByType]
  | {
      readonly type: 'pages'
      readonly pages: NonEmptyArray<{
        readonly page: ReadingPageRef
        readonly quads: NonEmptyArray<NormalizedQuad>
      }>
    }

/** A region on exactly one original page, independent of double-page or continuous display layout. */
export interface ReadingPageRegion {
  readonly page: ReadingPageRef
  readonly rect: NormalizedRect
}

/** Reading annotation target: a position, text selection or single-page region. */
export type ReadingAnnotationLocation =
  | { readonly type: 'position'; readonly position: ReadingPosition }
  | { readonly type: 'text'; readonly selection: ReadingTextSelection }
  | { readonly type: 'region'; readonly region: ReadingPageRegion }

/** A saved point or nonempty half-open range within a single video file, measured in seconds. */
export type PlaybackAnnotationLocation =
  | { readonly type: 'position'; readonly positionSeconds: number }
  | { readonly type: 'range'; readonly startSeconds: number; readonly endSeconds: number }

/**
 * Reading target accepting a persistent coordinate or the transient start instruction.
 *
 * The start instruction is never persisted as a location.
 */
export type ReadingPositionInput = ReadingPosition | 'start'

/** Playback target in file-local seconds or the transient start instruction. */
export type PlaybackPositionInput = number | 'start'

/** Persistent source anchors whose coordinates remain specific to their document format. */
const anchorSchema = v.variant('type', [
  v.strictObject({
    type: v.literal('epubCfi'),
    value: v.pipe(nonemptyText, v.transform(parseCfiPoint)),
  }),
  v.strictObject({
    type: v.literal('textOffset'),
    encoding: v.picklist(textEncodings),
    offset: nonnegativeInteger,
  }),
  v.strictObject({
    type: v.literal('xmlNode'),
    nodePath: v.array(nonnegativeInteger),
    textOffset: v.exactOptional(nonnegativeInteger),
  }),
  v.strictObject({
    type: v.literal('mobi'),
    byteOffset: nonnegativeInteger,
    textOffset: v.exactOptional(nonnegativeInteger),
  }),
  v.strictObject({
    type: v.literal('kf8'),
    documentIndex: nonnegativeInteger,
    byteOffset: nonnegativeInteger,
    textOffset: v.exactOptional(nonnegativeInteger),
  }),
])

/** Canonical relative document member identity preserving its original spelling. */
const memberPath = v.pipe(
  nonemptyText,
  v.check(
    (path) =>
      !/[\\\0]/.test(path) &&
      !/^[A-Za-z]:/.test(path) &&
      path.split('/').every((part) => part !== '' && part !== '.' && part !== '..'),
  ),
)

/** Original page identity independent of rendered page numbering and display layout. */
const pageSchema = v.variant('type', [
  v.strictObject({ type: v.literal('memberPath'), path: memberPath }),
  v.strictObject({ type: v.literal('pageIndex'), index: nonnegativeInteger }),
  v.strictObject({ type: v.literal('epubSpineItem'), index: nonnegativeInteger }),
  v.strictObject({ type: v.literal('kf8Document'), index: nonnegativeInteger }),
])

/**
 * Persistent reading location expressed as a source anchor or normalized point on an original
 * page.
 */
const positionSchema = v.variant('type', [
  v.strictObject({ type: v.literal('anchor'), anchor: anchorSchema }),
  v.strictObject({
    type: v.literal('page'),
    page: pageSchema,
    point: v.pipe(v.unknown(), v.transform(parseNormalizedPoint)),
  }),
])

/**
 * Parses a persisted canonical encoding name.
 *
 * Auto-detection options and aliases such as sjis are rejected.
 */
export function parseTextEncoding(input: unknown): TextEncoding {
  return parseValue(v.picklist(textEncodings), input, 'Invalid text encoding')
}

/**
 * Parses source-address syntax and integer bounds.
 *
 * The executor resolves the address against the actual file.
 */
export function parseReadingAnchor(input: unknown): ReadingAnchor {
  return parseValue(anchorSchema, input, 'Invalid reading anchor')
}

/** Parses an original-page reference while preserving exact source member names. */
export function parseReadingPageRef(input: unknown): ReadingPageRef {
  return parseValue(pageSchema, input, 'Invalid reading page reference')
}

/** Parses a persistent reading coordinate, excluding the transient start instruction. */
export function parseReadingPosition(input: unknown): ReadingPosition {
  return parseValue(positionSchema, input, 'Invalid reading position')
}

/**
 * Parses selection coordinates and geometry.
 *
 * Rejects mismatched addressing, identical anchor endpoints, empty page selections and duplicate
 * pages. Source-dependent ordering and continuity remain the executor's responsibility.
 */
export function parseReadingTextSelection(input: unknown): ReadingTextSelection {
  const quad = v.pipe(v.unknown(), v.transform(parseNormalizedQuad))
  const value = parseValue(
    v.variant('type', [
      v.strictObject({ type: v.literal('anchors'), start: anchorSchema, end: anchorSchema }),
      v.strictObject({
        type: v.literal('pages'),
        pages: v.pipe(
          v.tupleWithRest(
            [v.strictObject({ page: pageSchema, quads: v.tupleWithRest([quad], quad) })],
            v.strictObject({ page: pageSchema, quads: v.tupleWithRest([quad], quad) }),
          ),
          v.check((pages) => unique(pages, (page) => JSON.stringify(page.page))),
        ),
      }),
    ]),
    input,
    'Invalid reading selection',
  )
  if (
    value.type === 'anchors' &&
    (value.start.type !== value.end.type ||
      JSON.stringify(value.start) === JSON.stringify(value.end) ||
      (value.start.type === 'textOffset' &&
        value.end.type === 'textOffset' &&
        value.start.encoding !== value.end.encoding))
  ) {
    throw new DesktopError(
      'InvalidInput',
      'Reading selection endpoints must use the same addressing and define a nonempty range',
    )
  }

  return value as ReadingTextSelection
}

/** Parses a region on one original page and validates its geometry without clamping. */
export function parseReadingPageRegion(input: unknown): ReadingPageRegion {
  return parseValue(
    v.strictObject({
      page: pageSchema,
      rect: v.pipe(v.unknown(), v.transform(parseNormalizedRect)),
    }),
    input,
    'Invalid reading page region',
  )
}

/**
 * Parses a reading annotation's complete location value.
 *
 * File ownership and current availability are checked by their respective owners.
 */
export function parseReadingAnnotationLocation(input: unknown): ReadingAnnotationLocation {
  return parseValue(
    v.variant('type', [
      v.strictObject({ type: v.literal('position'), position: positionSchema }),
      v.strictObject({
        type: v.literal('text'),
        selection: v.pipe(v.unknown(), v.transform(parseReadingTextSelection)),
      }),
      v.strictObject({
        type: v.literal('region'),
        region: v.pipe(v.unknown(), v.transform(parseReadingPageRegion)),
      }),
    ]),
    input,
    'Invalid reading annotation location',
  )
}

/**
 * Parses a file-local point or strictly increasing time range in seconds.
 *
 * Validation checks nonnegative finite values; the media owner checks them against the actual
 * duration.
 */
export function parsePlaybackAnnotationLocation(input: unknown): PlaybackAnnotationLocation {
  return parseValue(
    v.variant('type', [
      v.strictObject({ type: v.literal('position'), positionSeconds: nonnegativeNumber }),
      v.pipe(
        v.strictObject({
          type: v.literal('range'),
          startSeconds: nonnegativeNumber,
          endSeconds: nonnegativeNumber,
        }),
        v.check((value) => value.startSeconds < value.endSeconds),
      ),
    ]),
    input,
    'Invalid playback annotation location',
  )
}
