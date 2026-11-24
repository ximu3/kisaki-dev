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

  writeGraph<const G extends LibraryWriteGraph>(
    input: G,
    call?: CallOptions,
  ): Promise<LibraryWriteResult<G>>

  merge<I extends EntryMergeInput>(input: I, call?: CallOptions): Promise<I['target']>

  delete(refs: NonEmptyArray<EntryRef>, call?: CallOptions): Promise<void>

  onInvalidated(listener: (value: LibraryInvalidation) => void): Disposable
}
