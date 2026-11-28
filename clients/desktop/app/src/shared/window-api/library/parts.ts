import type {
  MoveInput,
  PartCreate,
  PartDetails,
  PartKindChange,
  PartOrderScope,
  PartQuery,
  PartRef,
  PartUpdate,
  ReorderInput,
  VolumeChapter,
  VolumeChapterChange,
} from '@kisaki3/desktop-contracts/library'
import type { ListOptions, ListResult } from '@kisaki3/desktop-contracts/operations'
import type { WindowInput } from './images'

export interface PartWindowApi {
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
}
