/** @fileoverview Composes library capabilities and complete graph, merge and deletion operations. */

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
 * Saved library facts and complete graph, merge and deletion operations.
 *
 * Each capability owns its business transaction. Views consume snapshots; runtime sessions and
 * metadata acquisition remain separate owners.
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
  writeGraph(input: LibraryWriteGraph, call?: CallOptions): Promise<LibraryWriteResult>

  /** Applies fixed same-kind merge rules while preserving the explicitly selected survivor. */
  merge<I extends EntryMergeInput>(input: I, call?: CallOptions): Promise<I['target']>

  /**
   * Deletes selected entries with their complete owned scope atomically.
   *
   * Independent notes and user media bytes remain.
   */
  delete(refs: NonEmptyArray<EntryRef>, call?: CallOptions): Promise<void>

  /**
   * Subscribes to library-read invalidation.
   *
   * Callers subscribe before the first read and read again if invalidation occurs during it.
   * Editing drafts remain under their owners.
   */
  onInvalidated(listener: (value: LibraryInvalidation) => void): Disposable
}
