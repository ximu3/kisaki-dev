/** @fileoverview Assembles complete library capabilities from their unique value and operation owners. */

import type { CallOptions, Disposable, ListOptions, ListResult } from '../execution'
import type { ActivitiesApi } from './activities'
import type { AnnotationsApi } from './annotations'
import type {
  EntryCreateInput,
  EntryDetails,
  EntryUpdate,
  EntryUpdateInput,
  Evaluation,
  WorkStatus,
} from './catalog'
import type { CompletionsApi } from './completions'
import type { LibraryWriteGraph, LibraryWriteResult, VolumeChapter } from './graph'
import type { HoldingsApi } from './holdings'
import type { EntryRef, EntryType, ExternalIdentity, PartRef, WorkRef } from './identity'
import type { NotesApi } from './notes'
import type { MoveInput, OrderChange } from './ordering'
import type { CollectionsApi, TagsApi } from './organizers'
import type { PartsApi } from './parts'
import type {
  EntryListOptions,
  EntryListResult,
  EntryLocateOptions,
  EntryLocateResult,
} from './projections'
import type { EntryGroupsResult, EntryQuery, EntrySelection } from './queries'
import type { RelationsApi } from './relations'
import type { ShowcaseApi } from './showcase'
import type { LibraryChange } from './changes'

export interface EntriesApi {
  /** Read a bounded projection and exact matching total from one coherent snapshot. */
  list(query: EntryQuery, options: EntryListOptions, call?: CallOptions): Promise<EntryListResult>
  /** Read bounded own details, or null if absent from the current visible scope. */
  get<Type extends EntryType>(
    ref: EntryRef<Type>,
    call?: CallOptions,
  ): Promise<EntryDetails<Type> | null>
  /** Read long Markdown separately from bounded detail summaries. */
  getDescription(ref: EntryRef, call?: CallOptions): Promise<string | null>
  /** Locate a stable target and its surrounding interval in the exact current query/group. */
  locate(
    query: EntryQuery,
    target: EntryRef,
    options: EntryLocateOptions,
    call?: CallOptions,
  ): Promise<EntryLocateResult | null>
  /** Return actual group identities and counts; failed dynamic groups retain their errors. */
  groups(
    query: EntryQuery,
    grouping: { readonly type: 'collections' },
    call?: CallOptions,
  ): Promise<EntryGroupsResult>
  /** Fix all selected identities in one read without limiting selection to a fetched page. */
  selectRefs(
    query: EntryQuery,
    selection: EntrySelection,
    call?: CallOptions,
  ): Promise<readonly EntryRef[]>
  /** Match one complete source identity exactly using only the local visible library. */
  findByExternalIdentity(identity: ExternalIdentity, call?: CallOptions): Promise<EntryRef | null>
  /** Commit the complete entry, initial memberships, and applicable personal values atomically. */
  create<Type extends EntryType>(
    input: EntryCreateInput<Type>,
    call?: CallOptions,
  ): Promise<EntryRef<Type>>
  /** Modify only explicit fields and compare only their declared related baselines. */
  update<Type extends EntryType>(
    ref: EntryRef<Type>,
    input: EntryUpdateInput<NoInfer<Type>>,
    call?: CallOptions,
  ): Promise<void>
  /** Commit a short fixed unique-target batch together; one failed constraint prevents the whole write. */
  updateMany(input: readonly [EntryUpdate, ...EntryUpdate[]], call?: CallOptions): Promise<void>
  /** Set the explicit rating/favorite fields without inferring or modifying a work's status. */
  setEvaluation(
    ref: EntryRef,
    input: { readonly changes: Partial<Evaluation>; readonly expected?: Partial<Evaluation> },
    call?: CallOptions,
  ): Promise<void>
  /** Set only current status; completion histories and actual use remain separate. */
  setWorkStatus(work: WorkRef, status: WorkStatus | null, call?: CallOptions): Promise<void>
  /** Bind a precise source identity to this actual entry, rejecting another current binding. */
  bindExternalIdentity(ref: EntryRef, identity: ExternalIdentity, call?: CallOptions): Promise<void>
  /** Remove only this binding, without deleting source content or the local entry. */
  unbindExternalIdentity(
    ref: EntryRef,
    identity: ExternalIdentity,
    call?: CallOptions,
  ): Promise<void>
  /** Apply the fixed same-kind merge rules to explicit sources and return the retained actual entry. */
  merge<Type extends EntryType>(
    input: {
      readonly sources: readonly [EntryRef<Type>, ...EntryRef<Type>[]]
      readonly target: EntryRef<NoInfer<Type>>
    },
    call?: CallOptions,
  ): Promise<EntryRef<Type>>
  /** Confirm and remove the fixed identities and their owned facts; user media is never implicitly deleted. */
  delete(refs: EntryRef | readonly [EntryRef, ...EntryRef[]], call?: CallOptions): Promise<void>
}
/** Comic volume membership is a real ordered relation, independent of work chapter order or file associations. */
export interface VolumeChaptersApi {
  /** Read this volume's bounded chapter members and total in its own order. */
  list(
    volume: PartRef<'comicVolume'>,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<VolumeChapter>>
  /** Add/remove explicit members or replace the complete ordered set, retaining unrelated work numbering. */
  update(
    volume: PartRef<'comicVolume'>,
    input: {
      readonly change:
        | { readonly type: 'replace'; readonly items: readonly VolumeChapter[] }
        | {
            readonly type: 'modify'
            readonly add?: readonly VolumeChapter[]
            readonly remove?: readonly PartRef<'comicChapter'>[]
          }
      readonly expected?: { readonly members: readonly VolumeChapter[] }
    },
    call?: CallOptions,
  ): Promise<void>
  /** Save a member's volume-local number against its original value, without changing work numbering. */
  setNumberLabel(
    volume: PartRef<'comicVolume'>,
    chapter: PartRef<'comicChapter'>,
    input: {
      readonly numberLabel: string | null
      readonly expected?: { readonly numberLabel: string | null }
    },
    call?: CallOptions,
  ): Promise<void>
  /** Change only this volume's order against the complete original sequence. */
  reorder(volume: PartRef<'comicVolume'>, input: OrderChange, call?: CallOptions): Promise<void>
  /** Move current members relative to a real anchor without reconstructing hidden members from a filtered view. */
  move(volume: PartRef<'comicVolume'>, input: MoveInput, call?: CallOptions): Promise<void>
}
export interface LibraryApi {
  readonly entries: EntriesApi
  readonly parts: PartsApi & { readonly volumeChapters: VolumeChaptersApi }
  readonly completions: CompletionsApi
  readonly relations: RelationsApi
  readonly collections: CollectionsApi
  readonly tags: TagsApi
  readonly notes: NotesApi
  readonly annotations: AnnotationsApi
  readonly activities: ActivitiesApi
  readonly holdings: HoldingsApi
  readonly showcase: ShowcaseApi
  /** Atomically commit already determined local graph intent; failure never returns partial creation maps. */
  writeGraph(input: LibraryWriteGraph, call?: CallOptions): Promise<LibraryWriteResult>
  /** Deliver committed changes as one unit so consumers can invalidate their owned reads. */
  onInvalidated(listener: (changes: readonly LibraryChange[]) => void): Disposable
}
