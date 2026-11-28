import type { ErrorSummary } from '@kisaki3/desktop-contracts/errors'
import type {
  ContentDirectory,
  DirectoryDiscoveryDefinition,
  DirectoryRelocationInput,
  DirectoryUpdate,
  FileRecognitionResult,
  FileWorkType,
  HoldingsRelocationResult,
  WorkRef,
} from '@kisaki3/desktop-contracts/library'

export interface DirectoryWindowApi {
  'library.holdings.directories'(work: WorkRef): readonly ContentDirectory[]
  'library.holdings.updateDirectory'(
    work: WorkRef<FileWorkType>,
    id: string,
    input: DirectoryUpdate,
  ): void
  'library.holdings.removeDirectory'(work: WorkRef, id: string): void
  'library.holdings.openDirectory'(work: WorkRef, id: string): void
  'library.holdings.relocateDirectory'(
    work: WorkRef,
    id: string,
    input: DirectoryRelocationInput,
  ): HoldingsRelocationResult
  'library.holdings.previewDirectory'(
    work: WorkRef<FileWorkType>,
    id: string,
    definition: DirectoryDiscoveryDefinition,
    profileId: string | null,
  ): {
    items: readonly { path: string; registered: boolean; result: FileRecognitionResult | null }[]
    skipped: readonly string[]
    issues: readonly { path: string; error: ErrorSummary }[]
  }
}
