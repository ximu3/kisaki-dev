import type {
  FileAssociationEdit,
  FileCreateFields,
  FileMergeInput,
  FileMergeResult,
  FilePlaybackChoices,
  FileQuery,
  FileRecognitionDefinition,
  FileRecognitionResult,
  FileReidentificationResult,
  FileWorkType,
  HeldFile,
  HoldingsRelocationResult,
  PreferredFileInput,
  PreferredPartFile,
  WorkRef,
} from '@kisaki3/desktop-contracts/library'
import type { ListOptions, ListResult } from '@kisaki3/desktop-contracts/operations'
import type { VideoInformation } from '../../../media-information'

export interface FileWindowApi {
  'library.files.playbackChoices'(
    anime: string,
    file: string,
    input: { changes: Partial<FilePlaybackChoices>; expected?: Partial<FilePlaybackChoices> },
  ): void
  'library.files.list'(
    work: WorkRef<FileWorkType>,
    query: FileQuery,
    range: ListOptions,
  ): ListResult<HeldFile>
  'library.files.get'(work: WorkRef<FileWorkType>, id: string): HeldFile | null
  'library.files.add'(work: WorkRef<FileWorkType>, input: FileCreateFields): string
  'library.files.update'(
    work: WorkRef<FileWorkType>,
    id: string,
    input: { changes: { note?: string | null }; expected?: { note?: string | null } },
  ): void
  'library.files.remove'(work: WorkRef<FileWorkType>, ids: readonly string[]): void
  'library.files.reveal'(work: WorkRef<FileWorkType>, id: string): void
  'library.files.relocate'(
    work: WorkRef<FileWorkType>,
    id: string,
    path: string,
    expected: string,
  ): HoldingsRelocationResult<FileWorkType>
  'library.files.merge'(work: WorkRef<FileWorkType>, input: FileMergeInput): FileMergeResult
  'library.files.associations'(
    work: WorkRef<FileWorkType>,
    id: string,
    input: FileAssociationEdit,
  ): void
  'library.files.setMode'(
    work: WorkRef<FileWorkType>,
    id: string,
    mode: 'manual' | 'automatic',
    expected: 'manual' | 'automatic',
  ): void
  'library.files.setPreferred'(work: WorkRef<FileWorkType>, input: PreferredFileInput): void
  'library.files.setPreferredMany'(
    work: WorkRef<FileWorkType>,
    input: readonly PreferredPartFile[],
  ): void
  'library.files.inspectVideo'(work: WorkRef<'anime'>, id: string): VideoInformation
  'library.files.testRecognition'(
    work: WorkRef<FileWorkType>,
    id: string,
    input: { definition?: FileRecognitionDefinition },
  ): FileRecognitionResult
  'library.files.reidentify'(
    work: WorkRef<FileWorkType>,
    ids: readonly string[],
  ): FileReidentificationResult
}
