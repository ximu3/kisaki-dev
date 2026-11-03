/** @fileoverview Defines finite local adoption issues without arbitrary diagnostic payloads or field paths. */

import * as v from 'valibot'
import { parseErrorSummary } from '../errors'
import type { ErrorSummary } from '../errors'
import { id, nonemptyText, parseValue } from '../validation'
import {
  entryRefSchema,
  entryTypes,
  identitySchema,
  partRefSchema,
  workRefSchema,
} from '../library/catalog'
import type { EntryRef, EntryType, ExternalIdentity, PartRef, WorkRef } from '../library/catalog'
import { parseMetadataFieldRef } from '../metadata/fields'
import type { MetadataFieldRef, MetadataImageFieldRef } from '../metadata/fields'
import { getMetadataRelations } from '../metadata/relations'
import type { MetadataRelationKey } from '../metadata/relations'

/** Relation identity retains its root context rather than accepting an arbitrary dotted path. */
export type IngestRelationRef = {
  [K in EntryType]: { readonly entryType: K; readonly relation: MetadataRelationKey<K> }
}[EntryType]
/** Issues explain excluded branches or post-commit ancillary failures; they never authorize a partially valid graph write. */
export type IngestIssue = { readonly message: string } & (
  | {
      readonly code: 'providerFailed'
      readonly providerId: string
      readonly operation: 'resolve' | 'read'
      readonly error: ErrorSummary
    }
  | {
      readonly code: 'sourceAmbiguous'
      readonly providerId: string
      readonly entryType: EntryType
      readonly identity?: ExternalIdentity
    }
  | {
      readonly code: 'processorFailed'
      readonly processorId: string
      readonly field: MetadataFieldRef
      readonly error: ErrorSummary
    }
  | {
      readonly code: 'valueRejected'
      readonly field: MetadataFieldRef
      readonly reason: 'invalidValue' | 'unsupportedValue'
      readonly providerId?: string
      readonly target?: EntryRef | PartRef
      readonly identity?: ExternalIdentity
    }
  | {
      readonly code: 'associationSkipped'
      readonly relation: IngestRelationRef
      readonly reason:
        'missingEndpoint' | 'ambiguousEndpoint' | 'invalidDimension' | 'incompleteRange'
      readonly endpoints?: readonly (EntryRef | PartRef | ExternalIdentity)[]
    }
  | {
      readonly code: 'imageFailed'
      readonly field: MetadataImageFieldRef
      readonly error: ErrorSummary
      readonly target?: EntryRef | PartRef
      readonly providerId?: string
    }
  | { readonly code: 'holdingsFailed'; readonly work: WorkRef; readonly error: ErrorSummary }
)

/** Validate the relation's applicable root while preserving only actual known issue context. */
export function parseIngestRelationRef(input: unknown): IngestRelationRef {
  const { entryType } = parseValue(v.looseObject({ entryType: v.picklist(entryTypes) }), input)
  return parseValue(
    v.strictObject({
      entryType: v.literal(entryType),
      relation: v.picklist(getMetadataRelations(entryType)),
    }),
    input,
    'Invalid adoption relation reference',
  ) as IngestRelationRef
}
/** Parse one issue with its code-specific required context and a safe explanation, rejecting unknown detail bags. */
export function parseIngestIssue(input: unknown): IngestIssue {
  const message = nonemptyText
  const error = v.pipe(v.unknown(), v.transform(parseErrorSummary))
  const field = v.pipe(v.unknown(), v.transform(parseMetadataFieldRef))
  const target = v.union([entryRefSchema, partRefSchema])
  return parseValue(
    v.variant('code', [
      v.strictObject({
        code: v.literal('providerFailed'),
        message,
        providerId: id,
        operation: v.picklist(['resolve', 'read']),
        error,
      }),
      v.strictObject({
        code: v.literal('sourceAmbiguous'),
        message,
        providerId: id,
        entryType: v.picklist(entryTypes),
        identity: v.exactOptional(identitySchema),
      }),
      v.strictObject({
        code: v.literal('processorFailed'),
        message,
        processorId: id,
        field,
        error,
      }),
      v.strictObject({
        code: v.literal('valueRejected'),
        message,
        field,
        reason: v.picklist(['invalidValue', 'unsupportedValue']),
        providerId: v.exactOptional(id),
        target: v.exactOptional(target),
        identity: v.exactOptional(identitySchema),
      }),
      v.strictObject({
        code: v.literal('associationSkipped'),
        message,
        relation: v.pipe(v.unknown(), v.transform(parseIngestRelationRef)),
        reason: v.picklist([
          'missingEndpoint',
          'ambiguousEndpoint',
          'invalidDimension',
          'incompleteRange',
        ]),
        endpoints: v.exactOptional(v.array(v.union([target, identitySchema]))),
      }),
      v.strictObject({
        code: v.literal('imageFailed'),
        message,
        field: v.pipe(
          field,
          v.check(
            (value) =>
              (value.object === 'entry' || value.object === 'part') &&
              ['primaryImage', 'backdropImage', 'titleLogo', 'iconImage'].includes(value.field),
          ),
        ),
        error,
        target: v.exactOptional(target),
        providerId: v.exactOptional(id),
      }),
      v.strictObject({ code: v.literal('holdingsFailed'), message, work: workRefSchema, error }),
    ]),
    input,
    'Invalid adoption issue',
  ) as IngestIssue
}
