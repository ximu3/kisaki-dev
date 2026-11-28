import type {
  EntryRef,
  CollectionMember,
  TagEntry,
  CollectionMemberChange,
  TagEntryChange,
  OrganizerMerge,
  OrganizerMergeResult,
  ReorderInput,
  MoveInput,
} from '@kisaki3/desktop-contracts/library'
import type { ListOptions, ListResult } from '@kisaki3/desktop-contracts/operations'
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
}
