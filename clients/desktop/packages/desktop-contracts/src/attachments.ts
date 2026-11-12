/** @fileoverview Describes immutable saved attachments and explicit acquisition of their readable content. */

import type { ErrorSummary } from './errors'
import type { CallOptions, ListOptions, ListResult } from './operations'
import type { ReadResource, FileInput } from './resources'

/**
 * Registered metadata for immutable attachment bytes.
 *
 * The digest checks integrity; the attachment ID owns identity.
 */
export interface Attachment {
  readonly id: string
  readonly mediaType: string
  readonly sizeBytes: number
  readonly sha256: string

  /** Image width in pixels when known; null for content without known dimensions. */
  readonly width: number | null
  /** Image height in pixels when known; null for content without known dimensions. */
  readonly height: number | null

  /** UTC milliseconds since the Unix epoch. */
  readonly createdAt: number
}

/**
 * Reclaimed application-owned content and per-attachment cleanup failures.
 *
 * Only unreferenced, unheld content is eligible for removal.
 */
export interface AttachmentCleanupResult {
  readonly removedCount: number
  readonly reclaimedBytes: number
  readonly issues: readonly { readonly attachmentId: string; readonly error: ErrorSummary }[]
}

/**
 * Saved attachment metadata, byte acquisition, repair and orphan cleanup.
 *
 * A metadata read does not establish byte availability. Cleanup leaves business references
 * unchanged.
 */
export interface AttachmentsApi {
  /**
   * Reads registered attachment metadata, returning null when the identity is absent.
   *
   * The read does not acquire bytes or establish their current availability.
   */
  get(id: string, call?: CallOptions): Promise<Attachment | null>

  /**
   * Acquires fixed attachment content for the caller to release.
   *
   * Failure retains the saved attachment and all references.
   */
  read(id: string, call?: CallOptions): Promise<ReadResource>

  /**
   * Repairs attachment storage only when the complete bytes match the registered digest.
   *
   * Different content requires a new attachment.
   */
  repair(id: string, input: FileInput, call?: CallOptions): Promise<void>

  /** Removes orphaned managed content after rechecking applicable references and holds. */
  cleanup(call?: CallOptions): Promise<AttachmentCleanupResult>

  /**
   * Lists saved attachments with their current byte availability.
   *
   * Inspection retains references and reports missing or unreadable content without substituting
   * previews.
   */
  inspect(
    options: ListOptions,
    call?: CallOptions,
  ): Promise<
    ListResult<{
      readonly attachment: Attachment
      readonly available: boolean
    }>
  >
}
