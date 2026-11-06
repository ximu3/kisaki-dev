/** @fileoverview Describes immutable saved attachments and explicit acquisition of their readable content. */

import type { ErrorSummary } from './errors'
import type { CallOptions, ListOptions, ListResult } from './operations'
import type { ReadResource, FileInput } from './resources'

/** Actual registered bytes; a digest checks integrity but is not the attachment's identity. */
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

/** A reclamation report only describes unreferenced, unheld application-owned content. */
export interface AttachmentCleanupResult {
  readonly removedCount: number
  readonly reclaimedBytes: number
  readonly issues: readonly { readonly attachmentId: string; readonly error: ErrorSummary }[]
}

/** Saved identity reads do not imply byte availability. Cleanup never edits business references. */
export interface AttachmentsApi {
  /**
   * Read registered attachment metadata without acquiring bytes or claiming that the file is
   * currently available.
   */
  get(id: string, call?: CallOptions): Promise<Attachment | null>

  /** Acquire the fixed content or fail while retaining the saved attachment and all references. */
  read(id: string, call?: CallOptions): Promise<ReadResource>

  /** Repair only when the complete bytes match the registered digest; different content requires a new attachment. */
  repair(id: string, input: FileInput, call?: CallOptions): Promise<void>

  /** Remove provably orphaned managed content after all applicable references and holds have been rechecked. */
  cleanup(call?: CallOptions): Promise<AttachmentCleanupResult>

  /** Inspect missing or unreadable saved bytes without removing references or substituting cached previews. */
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
