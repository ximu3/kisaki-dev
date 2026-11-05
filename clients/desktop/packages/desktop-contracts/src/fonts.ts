/** @fileoverview Defines user font identity, verified font metadata and independent font-resource holds. */

import type { NonEmptyArray, ListOptions, CallOptions, ListResult, Disposable } from './operations'
import type { PreparedAttachment, ReadResourceRef, FileInput } from './resources'
import * as v from 'valibot'
import {
  text,
  nonnegativeInteger,
  nonemptyText,
  unique,
  id,
  parseValue,
  optionalFields,
  validateExpectedKeys,
} from './validation'
import { parsePreparedAttachment, parseFileInput } from './resources'

/** Consumers add their own default/document branches; this shared identity is only system family or user library ID. */
export type FontRef =
  | { readonly type: 'system'; readonly family: string }
  | { readonly type: 'user'; readonly id: string }

/** A static metric has equal min/default/max; variable metrics preserve their actual supported range. */
export interface FontMetricRange {
  readonly min: number
  readonly default: number
  readonly max: number
}

export interface FontVariationAxis extends FontMetricRange {
  readonly tag: string
}

/** Parsed face facts, not caller-authored claims. Weight and width use font/CSS metric units, not interface pixels. */
export interface FontFaceMetadata {
  readonly index: number
  readonly family: string
  readonly subfamily: string
  readonly fullName: string | null
  readonly postScriptName: string | null

  readonly weight: FontMetricRange
  readonly width: FontMetricRange
  readonly style: 'normal' | 'italic' | 'oblique'
  readonly axes: readonly FontVariationAxis[]
}

export interface FontFileMetadata {
  readonly faces: NonEmptyArray<FontFaceMetadata>
}

/** The host parses actual TTF/OTF/WOFF/WOFF2 content before issuing this hold; preparation does not create a Font. */
export interface PreparedFontFile extends PreparedAttachment {
  readonly metadata: FontFileMetadata
}

export interface FontFile {
  readonly attachmentId: string
  readonly metadata: FontFileMetadata
}

export interface Font {
  readonly id: string
  readonly name: string
  readonly files: NonEmptyArray<FontFile>
  /** UTC milliseconds since the Unix epoch. */
  readonly createdAt: number
  /** UTC milliseconds since the Unix epoch. */
  readonly updatedAt: number
}

/** The metadata and resource mapping describe one fixed read. Release is idempotent and does not affect other readers. */
export interface FontRead {
  readonly font: Font
  readonly resources: Readonly<Record<string, ReadResourceRef>>

  /**
   * Release this fixed read's resource holds idempotently; other reads and saved font references
   * remain unchanged.
   */
  dispose(): Promise<void>
}

export type FontFileInput = FileInput | PreparedFontFile

/** An existing attachment may only retain a file already owned by the font being edited. */
export type FontFileUpdateInput = FontFileInput | { readonly attachmentId: string }

export interface FontImportInput {
  readonly name: string
  readonly files: NonEmptyArray<FontFileInput>
}

export interface FontUpdate {
  readonly changes: { readonly name?: string; readonly files?: NonEmptyArray<FontFileUpdateInput> }
  readonly expected?: { readonly name?: string; readonly files?: NonEmptyArray<FontFile> }
}

/** User records and byte lifetimes are distinct. There is no clone operation or automatic deletion of unused fonts. */
export interface FontsApi {
  /** Search and page user font records only; system families are listed separately. */
  list(
    query: { readonly search: string },
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<Pick<Font, 'id' | 'name' | 'createdAt' | 'updatedAt'>>>

  /** Read saved font metadata without acquiring its files; a missing identity returns null. */
  get(id: string, call?: CallOptions): Promise<Font | null>

  /** Enumerate system family names without importing font files into the user library. */
  listSystem(call?: CallOptions): Promise<readonly string[]>

  /**
   * Verify file content and acquire parsed font metadata for preview; no Font record is created,
   * and the caller releases the hold.
   */
  prepare(input: FileInput, call?: CallOptions): Promise<PreparedFontFile>

  /**
   * Prepare all submitted files and commit one complete user font; failure leaves no partially
   * created font.
   */
  import(input: FontImportInput, call?: CallOptions): Promise<Font>

  /**
   * Compare the submitted name and final file set, preparing new files before one commit;
   * failure preserves the saved set.
   */
  update(id: string, input: FontUpdate, call?: CallOptions): Promise<Font>

  /**
   * Remove the user font record without rewriting saved selections; already acquired reads
   * retain their bytes until release.
   */
  delete(id: string, call?: CallOptions): Promise<void>

  /**
   * Acquire one fixed font and its readable files; failure releases partial acquisitions instead
   * of returning an incomplete read.
   */
  open(id: string, call?: CallOptions): Promise<FontRead>

  /**
   * Subscribe before reading the font directory; invalidation requests a fresh snapshot and does
   * not rewrite drafts.
   */
  onInvalidated(listener: () => void): Disposable
}

const metric = v.pipe(
  v.strictObject({
    min: v.pipe(v.number(), v.finite()),
    default: v.pipe(v.number(), v.finite()),
    max: v.pipe(v.number(), v.finite()),
  }),
  v.check((value) => value.min <= value.default && value.default <= value.max),
)

const positiveMetric = v.pipe(
  metric,
  v.check((value) => value.min > 0),
)

const axis = v.pipe(
  v.strictObject({ ...metric.entries, tag: v.pipe(text, v.regex(/^[\x20-\x7e]{4}$/)) }),
  v.check((value) => value.min <= value.default && value.default <= value.max),
)

const face = v.strictObject({
  index: nonnegativeInteger,
  family: nonemptyText,
  subfamily: text,
  fullName: v.nullable(text),
  postScriptName: v.nullable(text),

  weight: positiveMetric,
  width: positiveMetric,
  style: v.picklist(['normal', 'italic', 'oblique']),
  axes: v.pipe(
    v.array(axis),
    v.check((axes) => unique(axes, (axis) => axis.tag)),
  ),
})

const metadata = v.strictObject({
  faces: v.pipe(
    v.tupleWithRest([face], face),
    v.check((faces) => faces.every((face, index) => face.index === index)),
  ),
})

const file = v.strictObject({ attachmentId: id, metadata })

/** Validate a stable font reference without checking whether the selected family or user resource is currently available. */
export function parseFontRef(input: unknown): FontRef {
  return parseValue(
    v.variant('type', [
      v.strictObject({ type: v.literal('system'), family: nonemptyText }),
      v.strictObject({ type: v.literal('user'), id }),
    ]),
    input,
    'Invalid font reference',
  )
}

/** Validate read-only parsed metadata; registration/adoption still requires provenance from the real host decoder. */
export function parseFontFileMetadata(input: unknown): FontFileMetadata {
  return parseValue(metadata, input, 'Invalid font file metadata')
}

/** Check a prepared font interface while preserving its actual hold, not constructing a substitute resource. */
export function parsePreparedFontFile(input: unknown): PreparedFontFile {
  const attachment = parsePreparedAttachment(input)
  const withMetadata = input as PreparedFontFile
  parseFontFileMetadata(withMetadata.metadata)
  return attachment as PreparedFontFile
}

function fontInput(input: unknown): FontFileInput {
  return typeof input === 'object' && input !== null && 'attachmentId' in input
    ? parsePreparedFontFile(input)
    : parseFileInput(input)
}

function updateInput(input: unknown): FontFileUpdateInput {
  if (
    typeof input === 'object' &&
    input !== null &&
    'attachmentId' in input &&
    !('resource' in input)
  ) {
    return parseValue(v.strictObject({ attachmentId: id }), input)
  }

  return fontInput(input)
}

/** Require a name and at least one real file source; source decoding and byte-level deduplication belong to import. */
export function parseFontImport(input: unknown): FontImportInput {
  const source = v.pipe(v.unknown(), v.transform(fontInput))
  return parseValue(
    v.strictObject({ name: nonemptyText, files: v.tupleWithRest([source], source) }),
    input,
    'Invalid font import',
  )
}

/** Replacement is a complete nonempty file set. A name-only edit never compares or rewrites files. */
export function parseFontUpdate(input: unknown): FontUpdate {
  const source = v.pipe(v.unknown(), v.transform(updateInput))
  const value = parseValue(
    v.strictObject({
      changes: v.strictObject(
        optionalFields({ name: nonemptyText, files: v.tupleWithRest([source], source) }),
      ),
      expected: v.exactOptional(
        v.strictObject(
          optionalFields({ name: nonemptyText, files: v.tupleWithRest([file], file) }),
        ),
      ),
    }),
    input,
    'Invalid font edit',
  )
  validateExpectedKeys(value.changes, value.expected)
  return value
}
