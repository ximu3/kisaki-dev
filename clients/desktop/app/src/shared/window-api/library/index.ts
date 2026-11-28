import type {
  HeldFile,
  GameLaunchConfig,
  EntryMergeInput,
} from '@kisaki3/desktop-contracts/library'
import type { EntryViewTarget } from '@kisaki3/desktop-contracts/ui'
import type {
  PartCreate,
  PartQuery,
  PartDetails,
  PartRef,
  PartUpdate,
  PartOrderScope,
  PartKindChange,
  ActivitiesApi,
  Activity,
  ActivityStatistics,
  ActivityQuery,
  ActivityCreate,
  ActivityUpdate,
  CompletionsApi,
  CompletionStatistics,
  EntryCreate,
  EntryUpdate,
  EntryDetails,
  EntryQuery,
  EntryRef,
  EntrySelection,
  EntryListOptions,
  EntryListResult,
  EntryGroupsResult,
  EntryGroupKey,
  EntryLocateOptions,
  EntryLocateResult,
  ExternalIdentity,
  WorkRef,
  EvaluationUpdate,
  WorkStatusUpdate,
  ShowcaseSection,
  ShowcasePreset,
  ShowcaseFields,
  ShowcaseUpdate,
  ReorderInput,
  CompletionCreate,
  CompletionCreateItem,
  CompletionUpdate,
  WorkCompletion,
  CollectionQuery,
  CollectionListItem,
  Collection,
  CollectionCreate,
  CollectionUpdate,
  Tag,
  TagCreate,
  TagUpdate,
  TagQuery,
  TagListItem,
  DynamicRules,
} from '@kisaki3/desktop-contracts/library'
import type { ListOptions, ListResult, NonEmptyArray } from '@kisaki3/desktop-contracts/operations'
import type {
  RelationsApi,
  WorkCharacter,
  PersonWork,
  OrganizationWork,
  WorkRelation,
  WorkCharacterScope,
  PersonWorkScope,
  OrganizationWorkScope,
  WorkRelationScope,
  WorkCharacterUpdate,
  PersonWorkUpdate,
  OrganizationWorkUpdate,
  WorkRelationUpdate,
  WorkCharacterCreate,
  PersonWorkCreate,
  OrganizationWorkCreate,
  WorkRelationCreate,
} from '@kisaki3/desktop-contracts/library'
import type { HoldingsWindowApi } from './holdings'
import type { LibraryWriteGraph, LibraryWriteResult } from '@kisaki3/desktop-contracts/library'
import type { RecordsWindowApi } from './records'
import type {
  VolumeChapter,
  VolumeChapterChange,
  MoveInput,
} from '@kisaki3/desktop-contracts/library'
import type { OrganizerWindowApi } from './organizers'

export type RelationFamily = keyof RelationsApi
export type LibraryFact = WorkCharacter | PersonWork | OrganizationWork | WorkRelation
export type LibraryRelationScope =
  | WorkCharacterScope
  | PersonWorkScope
  | OrganizationWorkScope
  | WorkRelationScope
type WindowInput<T> = T extends unknown ? Omit<T, 'prepared'> : never

type WindowGraphValue<T> = T extends readonly unknown[]
  ? { [K in keyof T]: WindowGraphValue<T[K]> }
  : T extends object
    ? { [K in keyof T as Exclude<K, 'prepared'>]: WindowGraphValue<T[K]> }
    : T
export interface EntryLocation {
  entry: EntryRef
  parts: readonly PartDetails[]
  file?: HeldFile
  config?: GameLaunchConfig
}
export interface LibraryWindowApi extends HoldingsWindowApi, RecordsWindowApi, OrganizerWindowApi {
  'library.writeGraph'(
    graph: WindowGraphValue<LibraryWriteGraph>,
    images: readonly string[],
  ): LibraryWriteResult
  'library.activities.list'(query: ActivityQuery, range: ListOptions): ListResult<Activity>
  'library.activities.get'(work: WorkRef, id: string): Activity | null
  'library.activities.statistics'(
    query: Parameters<ActivitiesApi['statistics']>[0],
  ): ActivityStatistics
  'library.activities.create'(input: ActivityCreate): string
  'library.activities.update'(work: WorkRef, id: string, input: ActivityUpdate): void
  'library.activities.delete'(work: WorkRef, ids: readonly string[]): void
  'library.completions.statistics'(
    query: Parameters<CompletionsApi['statistics']>[0],
  ): CompletionStatistics
  'library.parts.list'(query: PartQuery, range: ListOptions): ListResult<PartDetails>
  'library.parts.move'(scope: PartOrderScope, input: MoveInput): void
  'library.volumeChapters.list'(id: string, range: ListOptions): ListResult<VolumeChapter>
  'library.volumeChapters.applyChanges'(id: string, change: VolumeChapterChange): void
  'library.volumeChapters.update'(
    id: string,
    chapter: string,
    numberLabel: string | null,
    expected: string | null,
  ): void
  'library.volumeChapters.move'(id: string, input: MoveInput): void
  'library.parts.get'(ref: PartRef): PartDetails | null
  'library.parts.create'(input: WindowInput<PartCreate>, images: readonly string[]): PartRef
  'library.parts.update'(input: WindowInput<PartUpdate>, images: readonly string[]): void
  'library.parts.setCompletedMany'(refs: readonly PartRef[], done: boolean): void
  'library.parts.changeKind'(
    ref: PartRef<'animeEpisode' | 'animeExtra'>,
    input: WindowInput<PartKindChange>,
    images: readonly string[],
  ): PartRef
  'library.parts.merge'(input: { source: PartRef; target: PartRef }): PartRef
  'library.parts.delete'(refs: readonly PartRef[]): void
  'library.parts.reorder'(scope: PartOrderScope, order: ReorderInput): void
  'library.merge'(input: EntryMergeInput): EntryRef
  'library.delete'(refs: readonly EntryRef[]): void
  'library.entries.locateTarget'(target: EntryViewTarget): EntryLocation
  'library.entries.organizers'(
    ref: EntryRef,
    spoilers: boolean,
  ): {
    tags: readonly { id: string; name: string; note: string | null; isSpoiler: boolean }[]
    collections: readonly { id: string; name: string; note: string | null }[]
  }
  'library.entries.get'(ref: EntryRef): EntryDetails | null
  'library.openExternalLink'(url: string): void
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
  'library.images.inMarkdown'(content: string): readonly string[]
  'library.images.open'(id: string): { hold: string; url: string }
  'library.relations.list'(
    family: RelationFamily,
    scope: LibraryRelationScope,
    range: ListOptions,
    spoilers: boolean,
  ): ListResult<LibraryFact>
  'library.relations.get'(family: RelationFamily, id: string, spoilers: boolean): LibraryFact | null
  'library.relations.create'(
    family: RelationFamily,
    input: WorkCharacterCreate | PersonWorkCreate | OrganizationWorkCreate | WorkRelationCreate,
  ): string
  'library.relations.update'(
    family: RelationFamily,
    id: string,
    input: WorkCharacterUpdate | PersonWorkUpdate | OrganizationWorkUpdate | WorkRelationUpdate,
  ): void
  'library.relations.delete'(family: RelationFamily, id: string): void
  'library.relations.reorder'(
    family: RelationFamily,
    scope: LibraryRelationScope,
    input: ReorderInput,
  ): void

  'library.collections.list'(
    query: CollectionQuery,
    options: ListOptions,
  ): ListResult<CollectionListItem>
  'library.collections.get'(id: string): Collection | null
  'library.collections.create'(
    input: WindowInput<CollectionCreate>,
    images: readonly string[],
  ): string
  'library.collections.update'(
    id: string,
    input: WindowInput<CollectionUpdate>,
    images: readonly string[],
  ): void
  'library.collections.delete'(id: string): void
  'library.collections.convertToManual'(id: string, expected: DynamicRules): void
  'library.tags.list'(query: TagQuery, options: ListOptions): ListResult<TagListItem>
  'library.tags.get'(id: string): Tag | null
  'library.tags.create'(input: WindowInput<TagCreate>, images: readonly string[]): string
  'library.tags.update'(id: string, input: WindowInput<TagUpdate>, images: readonly string[]): void
  'library.tags.delete'(id: string): void

  'library.showcase.list'(): readonly ShowcaseSection[]
  'library.showcase.get'(id: string): ShowcaseSection | null
  'library.showcase.listPresets'(): readonly ShowcasePreset[]
  'library.showcase.create'(input: ShowcaseFields): ShowcaseSection
  'library.showcase.createMany'(input: NonEmptyArray<ShowcaseFields>): readonly ShowcaseSection[]
  'library.showcase.update'(id: string, input: ShowcaseUpdate): ShowcaseSection
  'library.showcase.delete'(id: string): void
  'library.showcase.reorder'(input: ReorderInput): void

  'library.completions.list'(work: WorkRef, options: ListOptions): ListResult<WorkCompletion>
  'library.completions.get'(work: WorkRef, id: string): WorkCompletion | null
  'library.completions.create'(work: WorkRef, input: CompletionCreate): string
  'library.completions.recordCurrent'(work: WorkRef, input: CompletionCreate): string
  'library.completions.recordCurrentMany'(
    input: NonEmptyArray<CompletionCreateItem>,
  ): readonly { readonly work: WorkRef; readonly completionId: string }[]
  'library.completions.createMany'(input: NonEmptyArray<CompletionCreateItem>): readonly string[]
  'library.completions.update'(work: WorkRef, id: string, input: CompletionUpdate): void
  'library.completions.delete'(work: WorkRef, id: string): void
}
