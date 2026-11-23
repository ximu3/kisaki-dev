import type { EntriesApi, EntryMergeInput } from './entries'
import type { PartsApi } from './parts'
import type { RelationsApi } from './relations'
import type { CollectionsApi, TagsApi } from './organizers'
import type { NotesApi } from './notes'
import type { AnnotationsApi } from './annotations'
import type { ActivitiesApi } from './activities'
import type { CompletionsApi } from './completions'
import type { HoldingsApi } from './holdings/api'
import type { ShowcaseApi } from './showcase'
import type { LibraryWriteGraph, LibraryWriteResult } from './graph/write'
import type { CallOptions, NonEmptyArray, Disposable } from '../operations'
import type { EntryRef } from './catalog'
import type { LibraryInvalidation } from './changes'

/**
 * Reads return saved snapshots. Each write capability owns its transaction. Sessions and metadata
 * acquisition have separate entry points.
 */
export interface LibraryApi {
  readonly entries: EntriesApi
  readonly parts: PartsApi
  readonly relations: RelationsApi

  readonly collections: CollectionsApi
  readonly tags: TagsApi

  readonly notes: NotesApi
  readonly annotations: AnnotationsApi

  readonly activities: ActivitiesApi
  readonly completions: CompletionsApi

  readonly holdings: HoldingsApi
  readonly showcase: ShowcaseApi

  /**
   * Prepares resources, rechecks references and baselines, and commits the complete graph
   * atomically.
   */
  writeGraph<const G extends LibraryWriteGraph>(
    input: G,
    call?: CallOptions,
  ): Promise<LibraryWriteResult<G>>

  /** Applies fixed same-kind merge rules while preserving the explicitly selected survivor. */
  merge<I extends EntryMergeInput>(input: I, call?: CallOptions): Promise<I['target']>

  /**
   * Deletion includes the entries' owned scope in one transaction. Independent notes and user media
   * bytes remain.
   */
  delete(refs: NonEmptyArray<EntryRef>, call?: CallOptions): Promise<void>

  /**
   * Subscribe before the first read. Read again if an invalidation arrives during it. Drafts retain
   * their own state.
   */
  onInvalidated(listener: (value: LibraryInvalidation) => void): Disposable
}
