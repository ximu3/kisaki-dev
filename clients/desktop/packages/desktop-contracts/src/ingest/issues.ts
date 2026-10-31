/** @fileoverview Defines safe local adoption issues without arbitrary paths, hidden diagnostics, or guessed facts. */

import type { ErrorSummary } from '../errors'
import type { EntryRef, EntryType, ExternalIdentity, PartRef, WorkRef } from '../library/identity'
import type { MetadataField } from '../metadata/fields'
import type { MetadataRelationKey } from '../metadata/relations'

export type MetadataRelationAddress = {
  [Type in EntryType]: { readonly entryType: Type; readonly relation: MetadataRelationKey<Type> }
}[EntryType]
export type MetadataImageAddress = Extract<MetadataField, { object: 'entry' | 'part' }> & {
  readonly field: 'primaryImage' | 'backdropImage' | 'iconImage' | 'titleLogo'
}
/** Excluded branches or failed follow-up work accompany established results; they do not bypass atomic graph validation. */
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
      readonly field: MetadataField
      readonly error: ErrorSummary
    }
  | {
      readonly code: 'valueRejected'
      readonly field: MetadataField
      readonly reason: 'invalidValue' | 'unsupportedValue'
      readonly providerId?: string
      readonly target?: EntryRef | PartRef
      readonly identity?: ExternalIdentity
    }
  | {
      readonly code: 'associationSkipped'
      readonly relation: MetadataRelationAddress
      readonly reason:
        'missingEndpoint' | 'ambiguousEndpoint' | 'invalidDimension' | 'incompleteRange'
      readonly endpoints?: readonly (EntryRef | PartRef | ExternalIdentity)[]
    }
  | {
      readonly code: 'imageFailed'
      readonly field: MetadataImageAddress
      readonly error: ErrorSummary
      readonly target?: EntryRef | PartRef
      readonly providerId?: string
    }
  | { readonly code: 'holdingsFailed'; readonly work: WorkRef; readonly error: ErrorSummary }
)
