/** @fileoverview Defines read-only scan discovery and clue-extraction preview results. */

import type { WorkType } from '../library/catalog'
import type { ScanDefinition } from './configs'
import type { PathFilter } from '../paths'
import type { ClueExtractionResult } from './rules'
import type { ErrorSummary } from '../errors'
import type { ScanDiscovery } from './runs'

/** Draft work medium, discovery root and rules evaluated by a read-only preview. */
export interface ScanPreviewInput {
  readonly workType: WorkType
  readonly rootPath: string
  readonly definition: ScanDefinition
}

/** Discovered path with its exclusion, native extraction result or failure. */
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

/**
 * Discovery outcome and native clue-extraction results from a draft preview.
 *
 * Remote metadata acquisition and catalog adoption are separate operations.
 */
export interface ScanPreviewResult {
  readonly discovery: ScanDiscovery
  readonly paths: readonly ScanPreviewPath[]
}
