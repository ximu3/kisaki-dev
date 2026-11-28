import type {
  Collection,
  CollectionCreate,
  CollectionListItem,
  CollectionQuery,
  CollectionUpdate,
  DynamicRules,
  EntryRef,
  MoveInput,
  ReorderInput,
  Tag,
  TagCreate,
  TagListItem,
  TagQuery,
  TagUpdate,
} from '@kisaki3/desktop-contracts/library'
import type { ListOptions, ListResult } from '@kisaki3/desktop-contracts/operations'
import type { WindowInput } from './images'

import type {
  CollectionMember,
  CollectionMemberChange,
  OrganizerMerge,
  OrganizerMergeResult,
  TagEntry,
  TagEntryChange,
} from '@kisaki3/desktop-contracts/library'

export interface OrganizerWindowApi {
  'library.organizers.merge'(
    kind: 'collection' | 'tag',
    input: OrganizerMerge,
  ): OrganizerMergeResult
  'library.organizers.members'(
    kind: 'collection' | 'tag',
    id: string,
    range: ListOptions,
  ): ListResult<CollectionMember | TagEntry>
  'library.organizers.changeMembers'(
    kind: 'collection' | 'tag',
    id: string,
    change: CollectionMemberChange | TagEntryChange,
  ): void
  'library.organizers.updateMember'(
    kind: 'collection' | 'tag',
    id: string,
    entry: EntryRef,
    changes: { note?: string | null; isSpoiler?: boolean },
    expected: { note?: string | null; isSpoiler?: boolean },
  ): void
  'library.organizers.moveMember'(
    kind: 'collection' | 'tag',
    id: string,
    input: MoveInput<EntryRef>,
  ): void
  'library.collections.move'(input: MoveInput): void
  'library.collections.reorder'(input: ReorderInput): void
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
}
