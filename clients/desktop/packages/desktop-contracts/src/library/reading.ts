/** @fileoverview Defines persistent source positions and selections independently of any reading engine. */

import * as v from 'valibot'
import { objectSchema } from '../schema'
import {
  normalizedPointSchema,
  normalizedQuadSchema,
  normalizedRectSchema,
  type NormalizedPoint,
  type NormalizedQuad,
  type NormalizedRect,
} from '../geometry'
import {
  hasUniqueKeys,
  nonemptyStringSchema,
  nonnegativeIntegerSchema,
  parseContract,
} from '../validation'

/** Canonical lowercase WHATWG decoder names; aliases and automatic detection are not saved positions. */
export const textEncodings = [
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
] as const
export type TextEncoding = (typeof textEncodings)[number]

const anchorSchemas = {
  epubCfi: objectSchema({ type: v.literal('epubCfi'), value: nonemptyStringSchema }),
  textOffset: objectSchema({
    type: v.literal('textOffset'),
    encoding: v.picklist(textEncodings),
    offset: nonnegativeIntegerSchema,
  }),
  xmlNode: objectSchema({
    type: v.literal('xmlNode'),
    nodePath: v.pipe(v.array(nonnegativeIntegerSchema), v.readonly()),
    textOffset: v.exactOptional(nonnegativeIntegerSchema),
  }),
  mobi: objectSchema({
    type: v.literal('mobi'),
    byteOffset: nonnegativeIntegerSchema,
    textOffset: v.exactOptional(nonnegativeIntegerSchema),
  }),
  kf8: objectSchema({
    type: v.literal('kf8'),
    documentIndex: nonnegativeIntegerSchema,
    byteOffset: nonnegativeIntegerSchema,
    textOffset: v.exactOptional(nonnegativeIntegerSchema),
  }),
}
export const readingAnchorSchema = v.union(Object.values(anchorSchemas))
/** Source offsets are UTF-16 boundaries where applicable; source parsing validates actual existence and order. */
export type ReadingAnchor =
  | { readonly type: 'epubCfi'; readonly value: string }
  | { readonly type: 'textOffset'; readonly encoding: TextEncoding; readonly offset: number }
  | { readonly type: 'xmlNode'; readonly nodePath: readonly number[]; readonly textOffset?: number }
  | { readonly type: 'mobi'; readonly byteOffset: number; readonly textOffset?: number }
  | {
      readonly type: 'kf8'
      readonly documentIndex: number
      readonly byteOffset: number
      readonly textOffset?: number
    }

const memberPathSchema = v.pipe(
  nonemptyStringSchema,
  v.check(
    (path) =>
      !path.includes('\\') &&
      !path.includes('\0') &&
      path.split('/').every((part) => part !== '' && part !== '.' && part !== '..'),
  ),
)
export const readingPageRefSchema = v.union([
  objectSchema({
    type: v.picklist(['pageIndex', 'epubSpineItem', 'kf8Document']),
    index: nonnegativeIntegerSchema,
  }),
  objectSchema({ type: v.literal('memberPath'), path: memberPathSchema }),
])
/** An original page/member/spine identity, unaffected by display pagination or a two-page spread. */
export type ReadingPageRef =
  | { readonly type: 'pageIndex' | 'epubSpineItem' | 'kf8Document'; readonly index: number }
  | { readonly type: 'memberPath'; readonly path: string }
export const readingPositionSchema = v.union([
  objectSchema({ type: v.literal('anchor'), anchor: readingAnchorSchema }),
  objectSchema({
    type: v.literal('page'),
    page: readingPageRefSchema,
    point: normalizedPointSchema,
  }),
])
/** A persistent source position; file ownership is supplied by the containing record or operation. */
export type ReadingPosition =
  | { readonly type: 'anchor'; readonly anchor: ReadingAnchor }
  | { readonly type: 'page'; readonly page: ReadingPageRef; readonly point: NormalizedPoint }
/** start is an execution instruction and is never written as a stored position. */
export type ReadingPositionInput = ReadingPosition | 'start'

const anchorSelectionSchema = v.union([
  objectSchema({
    type: v.literal('anchors'),
    start: anchorSchemas.epubCfi,
    end: anchorSchemas.epubCfi,
  }),
  v.pipe(
    objectSchema({
      type: v.literal('anchors'),
      start: anchorSchemas.textOffset,
      end: anchorSchemas.textOffset,
    }),
    v.check((value) => value.start.encoding === value.end.encoding),
  ),
  objectSchema({
    type: v.literal('anchors'),
    start: anchorSchemas.xmlNode,
    end: anchorSchemas.xmlNode,
  }),
  objectSchema({ type: v.literal('anchors'), start: anchorSchemas.mobi, end: anchorSchemas.mobi }),
  objectSchema({ type: v.literal('anchors'), start: anchorSchemas.kf8, end: anchorSchemas.kf8 }),
])
const pageSelection = objectSchema({
  page: readingPageRefSchema,
  quads: v.pipe(v.tupleWithRest([normalizedQuadSchema], normalizedQuadSchema), v.readonly()),
})
export const readingTextSelectionSchema = v.union([
  v.pipe(
    anchorSelectionSchema,
    v.check((value) => JSON.stringify(value.start) !== JSON.stringify(value.end)),
  ),
  objectSchema({
    type: v.literal('pages'),
    pages: v.pipe(
      v.tupleWithRest([pageSelection], pageSelection),
      v.check((values) => hasUniqueKeys(values, (value) => JSON.stringify(value.page))),
      v.readonly(),
    ),
  }),
])
/** One nonempty continuous source selection; geometry preserves actual page and fragment order. */
export type ReadingTextSelection =
  | {
      [Type in ReadingAnchor['type']]: {
        readonly type: 'anchors'
        readonly start: Extract<ReadingAnchor, { type: Type }>
        readonly end: Extract<ReadingAnchor, { type: Type }>
      }
    }[ReadingAnchor['type']]
  | {
      readonly type: 'pages'
      readonly pages: readonly [
        {
          readonly page: ReadingPageRef
          readonly quads: readonly [NormalizedQuad, ...NormalizedQuad[]]
        },
        ...{
          readonly page: ReadingPageRef
          readonly quads: readonly [NormalizedQuad, ...NormalizedQuad[]]
        }[],
      ]
    }
export const readingPageRegionSchema = objectSchema({
  page: readingPageRefSchema,
  rect: normalizedRectSchema,
})
/** A region on exactly one original page, not a viewport screenshot spanning several pages. */
export interface ReadingPageRegion {
  readonly page: ReadingPageRef
  readonly rect: NormalizedRect
}
export const readingAnnotationLocationSchema = v.union([
  objectSchema({ type: v.literal('position'), position: readingPositionSchema }),
  objectSchema({ type: v.literal('text'), selection: readingTextSelectionSchema }),
  objectSchema({ type: v.literal('region'), region: readingPageRegionSchema }),
])
/** An annotation's real location, independent of saved text, images, and user comments. */
export type ReadingAnnotationLocation =
  | { readonly type: 'position'; readonly position: ReadingPosition }
  | { readonly type: 'text'; readonly selection: ReadingTextSelection }
  | { readonly type: 'region'; readonly region: ReadingPageRegion }

/** Check the source address shape; the opened source owns format grammar, boundaries, and recoverability. */
export function parseReadingAnchor(input: unknown): ReadingAnchor {
  return parseContract(readingAnchorSchema, input, 'reading anchor')
}
/** Parse a persisted position without repairing it to the beginning of a file. */
export function parseReadingPosition(input: unknown): ReadingPosition {
  return parseContract(readingPositionSchema, input, 'reading position')
}
/** Parse an explicit navigation instruction, retaining start separately from stored values. */
export function parseReadingPositionInput(input: unknown): ReadingPositionInput {
  return parseContract(
    v.union([readingPositionSchema, v.literal('start')]),
    input,
    'reading position input',
  )
}
/** Check matching address branches, nonempty selections, exact encoding, and valid source geometry. */
export function parseReadingTextSelection(input: unknown): ReadingTextSelection {
  return parseContract(readingTextSelectionSchema, input, 'reading text selection')
}
/** Parse one original page region without clipping or altering the input selection. */
export function parseReadingPageRegion(input: unknown): ReadingPageRegion {
  return parseContract(readingPageRegionSchema, input, 'reading page region')
}
/** Parse an annotation target without opening or reinterpreting the current file. */
export function parseReadingAnnotationLocation(input: unknown): ReadingAnnotationLocation {
  return parseContract(readingAnnotationLocationSchema, input, 'reading annotation location')
}
