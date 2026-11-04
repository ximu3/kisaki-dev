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

/** Each capability completes its own business transaction. Views consume snapshots; runtime sessions and metadata remain separate owners. */
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

  /** Prepare resources, recheck actual references/baselines and commit the complete graph atomically. */
  writeGraph(input: LibraryWriteGraph, call?: CallOptions): Promise<LibraryWriteResult>

  /** Apply fixed same-kind merge rules and preserve the explicitly selected survivor; no fuzzy matching or field-choice preview. */
  merge<I extends EntryMergeInput>(input: I, call?: CallOptions): Promise<I['target']>

  /** Delete each selected entry's complete owned scope atomically, preserving independent notes and user media bytes. */
  delete(refs: NonEmptyArray<EntryRef>, call?: CallOptions): Promise<void>

  /** Subscribe before the first read. An invalidation during a read requires another read; it never replaces an editing draft. */
  onInvalidated(listener: (value: LibraryInvalidation) => void): Disposable
}
