import type { ErrorSummary } from './errors'
import type { CallOptions, ListOptions, ListResult } from './operations'
import type { ReadResource, FileInput } from './resources'

export interface Attachment {
  readonly id: string
  readonly mediaType: string
  readonly sizeBytes: number
  readonly sha256: string

  readonly width: number | null
  readonly height: number | null

  readonly createdAt: number
}

export interface AttachmentCleanupResult {
  readonly removedCount: number
  readonly reclaimedBytes: number
  readonly issues: readonly { readonly attachmentId: string; readonly error: ErrorSummary }[]
}

export interface AttachmentsApi {
  get(id: string, call?: CallOptions): Promise<Attachment | null>

  read(id: string, call?: CallOptions): Promise<ReadResource>

  repair(id: string, input: FileInput, call?: CallOptions): Promise<void>

  cleanup(call?: CallOptions): Promise<AttachmentCleanupResult>

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
