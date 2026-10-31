/** @fileoverview Defines desktop font identities, immutable technical facts, preparation, and owned reads. */

import * as v from 'valibot'
import type { AsyncDisposable, CallOptions, ListOptions, ListResult } from './execution'
import type { FileInput, PreparedAttachment, ReadResourceRef } from './resources'
import { objectSchema } from './schema'
import { nonemptyStringSchema, nonnegativeIntegerSchema, parseContract } from './validation'

/** A selected system family or stable user font identity; document/default choices belong to their consumers. */
export type FontRef =
  | { readonly type: 'system'; readonly family: string }
  | { readonly type: 'user'; readonly id: string }
/** Actual min/default/max values; static faces have three equal values. */
export interface FontValueRange {
  readonly min: number
  readonly default: number
  readonly max: number
}
/** One decoded face, with zero-based file index and actual OpenType variation axes. */
export interface FontFaceMetadata {
  readonly index: number
  readonly family: string
  readonly subfamily: string
  readonly fullName: string | null
  readonly postScriptName: string | null
  readonly weight: FontValueRange
  readonly width: FontValueRange
  readonly style: 'normal' | 'italic' | 'oblique'
  readonly axes: readonly (FontValueRange & { readonly tag: string })[]
}
/** Metadata is generated from verified immutable bytes, never accepted as caller-supplied font truth. */
export interface FontFileMetadata {
  readonly faces: readonly FontFaceMetadata[]
}
export interface Font {
  readonly id: string
  readonly name: string
  readonly files: readonly { readonly attachmentId: string; readonly metadata: FontFileMetadata }[]
  readonly createdAt: number
  readonly updatedAt: number
}
/** Prepared bytes can be previewed without creating a visible user-font record. */
export interface PreparedFontFile extends PreparedAttachment {
  readonly metadata: FontFileMetadata
}
/** One fixed definition and resource snapshot. Disposal releases only this read's occupancy. */
export interface FontRead extends AsyncDisposable {
  readonly font: Font
  readonly resources: Readonly<Record<string, ReadResourceRef>>
}
export interface FontImport {
  readonly name: string
  readonly files: readonly [FileInput | PreparedFontFile, ...(FileInput | PreparedFontFile)[]]
}
/** Existing attachment IDs must belong to the edited font; files are replaced atomically as a complete set. */
export interface FontUpdate {
  readonly changes: {
    readonly name?: string
    readonly files?: readonly [
      { readonly attachmentId: string } | FileInput | PreparedFontFile,
      ...({ readonly attachmentId: string } | FileInput | PreparedFontFile)[],
    ]
  }
  readonly expected?: { readonly name?: string; readonly files?: readonly string[] }
}
/** User fonts have independent lifetime and are not deleted when a theme or reader stops selecting them. */
export interface FontsApi {
  /** Read user-font summaries and a coherent total without opening their files. */
  list(
    query: { readonly search: string },
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<Pick<Font, 'id' | 'name' | 'createdAt' | 'updatedAt'>>>
  /** Read the complete saved font definition or null. */
  get(id: string, call?: CallOptions): Promise<Font | null>
  /** Return distinct actual system families; this does not import their bytes. */
  listSystem(call?: CallOptions): Promise<readonly string[]>
  /** Validate and retain one input's font bytes and technical facts for optional preview. */
  prepare(input: FileInput, call?: CallOptions): Promise<PreparedFontFile>
  /** Prepare and save the whole font; failure does not leave a partially registered font. */
  import(input: FontImport, call?: CallOptions): Promise<Font>
  /** Prepare new inputs, compare actual baselines, then replace the requested fields atomically. */
  update(id: string, input: FontUpdate, call?: CallOptions): Promise<Font>
  /** Delete only the user record and its references, preserving other live resource occupancy. */
  delete(id: string, call?: CallOptions): Promise<void>
  /** Acquire the complete fixed font and its bytes; any acquisition failure releases this read's resources. */
  open(id: string, call?: CallOptions): Promise<FontRead>
  /** Establish invalidation delivery before returning the subscription handle. */
  onInvalidated(listener: () => void): Promise<AsyncDisposable>
}

export const fontRefSchema: v.GenericSchema<unknown, FontRef> = v.union([
  objectSchema({ type: v.literal('system'), family: nonemptyStringSchema }),
  objectSchema({ type: v.literal('user'), id: nonemptyStringSchema }),
])
const finite = v.pipe(v.number(), v.finite())
const range = v.pipe(
  objectSchema({ min: finite, default: finite, max: finite }),
  v.check((value) => value.min <= value.default && value.default <= value.max),
)
const axis = v.pipe(
  objectSchema({
    tag: v.pipe(v.string(), v.regex(/^[ -~]{4}$/)),
    min: finite,
    default: finite,
    max: finite,
  }),
  v.check((value) => value.min <= value.default && value.default <= value.max),
)
const face = objectSchema({
  index: nonnegativeIntegerSchema,
  family: nonemptyStringSchema,
  subfamily: v.string(),
  fullName: v.nullable(v.string()),
  postScriptName: v.nullable(v.string()),
  weight: range,
  width: range,
  style: v.picklist(['normal', 'italic', 'oblique']),
  axes: v.pipe(
    v.array(axis),
    v.check((values) => new Set(values.map((value) => value.tag)).size === values.length),
    v.readonly(),
  ),
})

/** Parse a stable selection without resolving system fonts or opening stored files. */
export function parseFontRef(input: unknown): FontRef {
  return parseContract(fontRefSchema, input, 'font reference')
}
/** Validate actual extracted facts; import still verifies these facts against the real acquired bytes. */
export function parseFontFileMetadata(input: unknown): FontFileMetadata {
  return parseContract(
    objectSchema({
      faces: v.pipe(
        v.tupleWithRest([face], face),
        v.check((values) => new Set(values.map((value) => value.index)).size === values.length),
        v.readonly(),
      ),
    }),
    input,
    'font metadata',
  )
}
