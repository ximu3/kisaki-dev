import type {
  EntryMergeInput,
  EntryRef,
  LibraryWriteGraph,
  LibraryWriteResult,
} from '@kisaki3/desktop-contracts/library'
import type { EntryWindowApi } from './entries'
import type { HoldingsWindowApi } from './holdings'
import type { LibraryImageWindowApi } from './images'
import type { OrganizerWindowApi } from './organizers'
import type { PartWindowApi } from './parts'
import type { RecordsWindowApi } from './records'
import type { RelationWindowApi } from './relations'
import type { ShowcaseWindowApi } from './showcase'

export type { EntryLocation } from './entries'

export type { LibraryFact, LibraryRelationScope, RelationFamily } from './relations'

type WindowGraphValue<T> = T extends readonly unknown[]
  ? { [K in keyof T]: WindowGraphValue<T[K]> }
  : T extends object
    ? { [K in keyof T as Exclude<K, 'prepared'>]: WindowGraphValue<T[K]> }
    : T

export interface LibraryWindowApi
  extends
    HoldingsWindowApi,
    RecordsWindowApi,
    OrganizerWindowApi,
    PartWindowApi,
    EntryWindowApi,
    LibraryImageWindowApi,
    RelationWindowApi,
    ShowcaseWindowApi {
  'library.writeGraph'(
    graph: WindowGraphValue<LibraryWriteGraph>,
    images: readonly string[],
  ): LibraryWriteResult
  'library.merge'(input: EntryMergeInput): EntryRef
  'library.delete'(refs: readonly EntryRef[]): void
  'library.openExternalLink'(url: string): void
}
