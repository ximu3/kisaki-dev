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

/**
 * A shared system-family or user-library font identity.
 *
 * Consumers define their own default or document-font selections.
 */
export type FontRef =
  | { readonly type: 'system'; readonly family: string }
  | { readonly type: 'user'; readonly id: string }

/**
 * A font metric's supported range and default.
 *
 * Static metrics have equal minimum, default and maximum values.
 */
export interface FontMetricRange {
  readonly min: number
  readonly default: number
  readonly max: number
}

/** An actual four-byte OpenType variation-axis tag and its supported metric range. */
export interface FontVariationAxis extends FontMetricRange {
  readonly tag: string
}

/**
 * Face facts parsed from font bytes by the host.
 *
 * Weight and width use font/CSS metric units rather than interface pixels.
 */
export interface FontFaceMetadata {
  /** Zero-based face index within the font file. */
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

/** The nonempty sequence of faces decoded from a font file in index order. */
export interface FontFileMetadata {
  readonly faces: NonEmptyArray<FontFaceMetadata>
}

/**
 * A temporary font-content hold with metadata parsed from actual TTF, OTF, WOFF or WOFF2 bytes.
 *
 * Preparation creates no user Font record. The caller owns release of the hold.
 */
export interface PreparedFontFile extends PreparedAttachment {
  readonly metadata: FontFileMetadata
}

/** An immutable attachment and its host-parsed font metadata. */
export interface FontFile {
  readonly attachmentId: string
  readonly metadata: FontFileMetadata
}

/** A user-library font identity with a name, file set and creation and update times. */
export interface Font {
  readonly id: string
  readonly name: string
  readonly files: NonEmptyArray<FontFile>
  /** UTC milliseconds since the Unix epoch. */
  readonly createdAt: number
  /** UTC milliseconds since the Unix epoch. */
  readonly updatedAt: number
}

/**
 * A fixed font snapshot and independently owned file-resource holds.
 *
 * Disposal leaves the plain snapshot readable while ending access through its resources.
 */
export interface FontRead {
  readonly font: Font
  /** Acquired file resources indexed by attachment ID. */
  readonly resources: Readonly<Record<string, ReadResourceRef>>

  /**
   * Releases this read's holds idempotently while preserving other reads and saved font references.
   */
  dispose(): Promise<void>
}

/** A new font-file source or an already prepared font-content hold. */
export type FontFileInput = FileInput | PreparedFontFile

/** A new font-file input or a retained attachment already owned by the font being edited. */
export type FontFileUpdateInput = FontFileInput | { readonly attachmentId: string }

/** A name and nonempty file set for creating one user-library font. */
export interface FontImportInput {
  readonly name: string
  readonly files: NonEmptyArray<FontFileInput>
}

/**
 * Name and complete file-set changes with optional expected values.
 *
 * Omitted files remain unchanged. A supplied nonempty file set replaces the existing set as one
 * comparison unit.
 */
export interface FontUpdate {
  readonly changes: { readonly name?: string; readonly files?: NonEmptyArray<FontFileUpdateInput> }
  readonly expected?: { readonly name?: string; readonly files?: NonEmptyArray<FontFile> }
}

/**
 * User-font records, system-family discovery and explicitly acquired font resources.
 *
 * Saved records and byte holds have separate lifetimes. User fonts remain until explicitly deleted.
 */
export interface FontsApi {
  /** Searches and pages user-font records; system families are listed separately. */
  list(
    query: { readonly search: string },
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<Pick<Font, 'id' | 'name' | 'createdAt' | 'updatedAt'>>>

  /** Reads saved font metadata without acquiring files, returning null for an absent identity. */
  get(id: string, call?: CallOptions): Promise<Font | null>

  /** Lists distinct system family names without importing their files into the user library. */
  listSystem(call?: CallOptions): Promise<readonly string[]>

  /**
   * Verifies font bytes and returns a hold with parsed metadata for preview.
   *
   * The caller releases the hold; preparation creates no Font record.
   */
  prepare(input: FileInput, call?: CallOptions): Promise<PreparedFontFile>

  /**
   * Prepares submitted files and commits one complete user font.
   *
   * Failure leaves no partially created font.
   */
  import(input: FontImportInput, call?: CallOptions): Promise<Font>

  /**
   * Compares submitted fields and commits the name or final file set after preparing new files.
   *
   * Failure preserves the saved set.
   */
  update(id: string, input: FontUpdate, call?: CallOptions): Promise<Font>

  /**
   * Removes the user-font record while preserving saved consumer selections.
   *
   * Acquired reads retain their bytes until release.
   */
  delete(id: string, call?: CallOptions): Promise<void>

  /**
   * Acquires one fixed font and all its readable files for the caller to release.
   *
   * Failure releases partial acquisitions and rejects the read.
   */
  open(id: string, call?: CallOptions): Promise<FontRead>

  /**
   * Subscribes to font-directory invalidation before the caller reads a snapshot.
   *
   * Notifications leave editing drafts under their owners.
   */
  onInvalidated(listener: () => void): Disposable
}

/** Finite font metric range whose default lies between its bounds. */
const metric = v.pipe(
  v.strictObject({
    min: v.pipe(v.number(), v.finite()),
    default: v.pipe(v.number(), v.finite()),
    max: v.pipe(v.number(), v.finite()),
  }),
  v.check((value) => value.min <= value.default && value.default <= value.max),
)

/** Font metric range restricted to positive values for weight and width. */
const positiveMetric = v.pipe(
  metric,
  v.check((value) => value.min > 0),
)

/** Four-character OpenType axis tag and its validated default and bounds. */
const axis = v.pipe(
  v.strictObject({ ...metric.entries, tag: v.pipe(text, v.regex(/^[\x20-\x7e]{4}$/)) }),
  v.check((value) => value.min <= value.default && value.default <= value.max),
)

/** Font-face identity, style, metric ranges and distinct variation axes. */
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

/** Nonempty font-face metadata with contiguous source face indexes. */
const metadata = v.strictObject({
  faces: v.pipe(
    v.tupleWithRest([face], face),
    v.check((faces) => faces.every((face, index) => face.index === index)),
  ),
})

/** An immutable font attachment paired with its validated face metadata. */
const file = v.strictObject({ attachmentId: id, metadata })

/** Parses a stable font reference without checking current family or resource availability. */
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

/**
 * Parses face metadata, index order and metric ranges.
 *
 * Registration and adoption separately require provenance from the actual host decoder.
 */
export function parseFontFileMetadata(input: unknown): FontFileMetadata {
  return parseValue(metadata, input, 'Invalid font file metadata')
}

/** Checks a prepared font interface and metadata while preserving its actual resource hold. */
export function parsePreparedFontFile(input: unknown): PreparedFontFile {
  const attachment = parsePreparedAttachment(input)
  const withMetadata = input as PreparedFontFile
  parseFontFileMetadata(withMetadata.metadata)
  return attachment as PreparedFontFile
}

/** Parses a prepared font hold or delegates a new source to the common file-input parser. */
function parseFontFileInput(input: unknown): FontFileInput {
  return typeof input === 'object' && input !== null && 'attachmentId' in input
    ? parsePreparedFontFile(input)
    : parseFileInput(input)
}

/**
 * Parses a retained attachment identity or a new font-file input.
 *
 * The update operation separately verifies ownership of retained attachments.
 */
function parseFontFileUpdateInput(input: unknown): FontFileUpdateInput {
  if (
    typeof input === 'object' &&
    input !== null &&
    'attachmentId' in input &&
    !('resource' in input)
  ) {
    return parseValue(v.strictObject({ attachmentId: id }), input)
  }

  return parseFontFileInput(input)
}

/**
 * Parses a font name and nonempty file-source set.
 *
 * The import operation owns source decoding and byte-level deduplication.
 */
export function parseFontImport(input: unknown): FontImportInput {
  const source = v.pipe(v.unknown(), v.transform(parseFontFileInput))
  return parseValue(
    v.strictObject({ name: nonemptyText, files: v.tupleWithRest([source], source) }),
    input,
    'Invalid font import',
  )
}

/** Parses font changes and expected values for the same name or complete file-set units. */
export function parseFontUpdate(input: unknown): FontUpdate {
  const source = v.pipe(v.unknown(), v.transform(parseFontFileUpdateInput))
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
