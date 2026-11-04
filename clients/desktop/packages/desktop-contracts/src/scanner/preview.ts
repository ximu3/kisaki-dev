/** @fileoverview Defines read-only scan discovery and clue-extraction preview results. */

import type { WorkType } from '../library/catalog'
import type { ScanDefinition } from './configs'
import type { PathFilter } from '../paths'
import type { ClueExtractionResult } from './rules'
import type { ErrorSummary } from '../errors'
import type { ScanDiscovery } from './runs'

export interface ScanPreviewInput {
  readonly workType: WorkType
  readonly rootPath: string
  readonly definition: ScanDefinition
}

export type ScanPreviewPath = {
  readonly path: string
  readonly relativePath: string
  readonly kind: 'directory' | 'file'
} & (
  | { readonly outcome: 'excluded'; readonly filter: PathFilter }
  | {
      readonly outcome: 'candidate'
      readonly baseName: string
      readonly extraction: ClueExtractionResult
    }
  | { readonly outcome: 'failed'; readonly error: ErrorSummary }
)

/** Read-only discovery and native extraction, without remote metadata acquisition or a selectable adoption plan. */
export interface ScanPreviewResult {
  readonly discovery: ScanDiscovery
  readonly paths: readonly ScanPreviewPath[]
}
