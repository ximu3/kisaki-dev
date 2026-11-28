import type {
  EntryCreate,
  EntryDetails,
  EntryGroupKey,
  EntryGroupsResult,
  EntryListOptions,
  EntryListResult,
  EntryLocateOptions,
  EntryLocateResult,
  EntryQuery,
  EntryRef,
  EntrySelection,
  EntryUpdate,
  EvaluationUpdate,
  ExternalIdentity,
  GameLaunchConfig,
  HeldFile,
  PartDetails,
  WorkRef,
  WorkStatusUpdate,
} from '@kisaki3/desktop-contracts/library'
import type { NonEmptyArray } from '@kisaki3/desktop-contracts/operations'
import type { EntryViewTarget } from '@kisaki3/desktop-contracts/ui'
import type { WindowInput } from './images'

export interface EntryLocation {
  entry: EntryRef
  parts: readonly PartDetails[]
  file?: HeldFile
  config?: GameLaunchConfig
}

export interface EntryWindowApi {
  'library.entries.locateTarget'(target: EntryViewTarget): EntryLocation
  'library.entries.organizers'(
    ref: EntryRef,
    spoilers: boolean,
  ): {
    tags: readonly { id: string; name: string; note: string | null; isSpoiler: boolean }[]
    collections: readonly { id: string; name: string; note: string | null }[]
  }
  'library.entries.get'(ref: EntryRef): EntryDetails | null
  'library.entries.copyLink'(ref: EntryRef): void
  'library.entries.resolveRefs'(
    refs: readonly EntryRef[],
  ): readonly (EntryRef & { name: string; primaryImageId: string | null })[]
  'library.entries.getDescription'(ref: EntryRef): string | null
  'library.entries.findByExternalIdentity'(identity: ExternalIdentity): EntryRef | null
  'library.entries.list'(query: EntryQuery, options: EntryListOptions): EntryListResult
  'library.entries.groups'(query: EntryQuery): EntryGroupsResult
  'library.entries.locateInGroups'(
    query: EntryQuery,
    ref: EntryRef,
    preferred: EntryGroupKey | null,
  ): { group: EntryGroupKey; index: number } | null
  'library.entries.updateMany'(values: NonEmptyArray<WindowInput<EntryUpdate>>): void
  'library.entries.locate'(
    query: EntryQuery,
    ref: EntryRef,
    options: EntryLocateOptions,
  ): EntryLocateResult | null
  'library.entries.selectRefs'(query: EntryQuery, selection: EntrySelection): readonly EntryRef[]
  'library.entries.create'(input: WindowInput<EntryCreate>, images: readonly string[]): EntryRef
  'library.entries.update'(input: WindowInput<EntryUpdate>, images: readonly string[]): void
  'library.entries.setEvaluation'(ref: EntryRef, input: EvaluationUpdate): void
  'library.entries.setWorkStatus'(work: WorkRef, input: WorkStatusUpdate): void
}
