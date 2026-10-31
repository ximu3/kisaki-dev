/** @fileoverview Describes committed library facts without exposing rows, user bodies, or mutable object snapshots. */

import type { EntryRef, ExternalIdentity, PartRef, WorkRef, WorkType } from './identity'
import type { RelationBindings, RelationKind, RelationRef } from './relations'

/** Minimal identity preserved for a real deletion or merge; it is not a second metadata record. */
export interface EntryIdentitySnapshot {
  readonly ref: EntryRef
  readonly name: string
  readonly externalIdentities: readonly ExternalIdentity[]
}
export interface PartIdentitySnapshot {
  readonly ref: PartRef
  readonly name: string | null
  readonly externalIdentities: readonly ExternalIdentity[]
}
type RelationChange = {
  [Type in RelationKind]: {
    readonly type: 'relationCreated' | 'relationUpdated' | 'relationDeleted'
    readonly relation: RelationRef<Type>
    readonly binding: RelationBindings[Type]
  }
}[RelationKind]
type AnnotationChange = {
  [Type in WorkType]: {
    readonly type: 'annotationCreated' | 'annotationUpdated' | 'annotationDeleted'
    readonly annotationId: string
    readonly work: EntryRef<Type>
  } & (Type extends 'game' ? object : { readonly fileId: string | null })
}[WorkType]
/** Changes summarize one complete operation; no receiver must reconstruct a database transaction from row events. */
export type LibraryChange =
  | {
      readonly type: 'entryCreated' | 'entryUpdated' | 'evaluationChanged'
      readonly entry: EntryRef
    }
  | { readonly type: 'entryDeleted'; readonly snapshot: EntryIdentitySnapshot }
  | {
      readonly type: 'entriesMerged'
      readonly sources: readonly EntryIdentitySnapshot[]
      readonly target: EntryRef
    }
  | { readonly type: 'workRecordChanged'; readonly work: WorkRef }
  | {
      readonly type: 'partCreated' | 'partUpdated' | 'partDeleted' | 'partRecordChanged'
      readonly part: PartRef
      readonly work: WorkRef
    }
  | {
      readonly type: 'partMoved'
      readonly part: PartRef
      readonly fromWork: WorkRef
      readonly toWork: WorkRef
    }
  | {
      readonly type: 'partKindChanged'
      readonly fromPart: PartRef
      readonly toPart: PartRef
      readonly work: WorkRef
    }
  | {
      readonly type: 'partMerged'
      readonly source: PartIdentitySnapshot
      readonly target: PartRef
      readonly work: WorkRef
    }
  | RelationChange
  | { readonly type: 'collectionCreated' | 'collectionUpdated'; readonly collectionId: string }
  | { readonly type: 'collectionDeleted'; readonly collectionId: string; readonly name: string }
  | {
      readonly type: 'collectionsMerged'
      readonly sourceIds: readonly string[]
      readonly targetId: string
    }
  | {
      readonly type: 'collectionMembersChanged'
      readonly collectionId: string
      readonly entries: readonly EntryRef[]
    }
  | { readonly type: 'tagCreated' | 'tagUpdated'; readonly tagId: string }
  | { readonly type: 'tagDeleted'; readonly tagId: string; readonly name: string }
  | {
      readonly type: 'tagsMerged'
      readonly sourceIds: readonly string[]
      readonly targetId: string
    }
  | {
      readonly type: 'entryTagsChanged'
      readonly entry: EntryRef
      readonly tagIds: readonly string[]
    }
  | {
      readonly type: 'noteCreated' | 'noteUpdated' | 'noteDeleted'
      readonly noteId: string
      readonly entries: readonly EntryRef[]
    }
  | AnnotationChange
  | {
      readonly type: 'activityCreated' | 'activityUpdated' | 'activityDeleted'
      readonly activityId: string
      readonly work: WorkRef
    }
  | {
      readonly type: 'holdingsChanged'
      readonly work: WorkRef
      readonly directoryIds?: readonly string[]
      readonly fileIds?: readonly string[]
      readonly launchConfigIds?: readonly string[]
      readonly backupIds?: readonly string[]
      readonly fileMerged?: { readonly sourceFileId: string; readonly targetFileId: string }
    }
  | { readonly type: 'showcaseChanged'; readonly sectionIds: readonly string[] }
export interface LibraryChangedEvent {
  readonly committedAt: number
  readonly changes: readonly LibraryChange[]
}
