/** @fileoverview Describes one atomic catalog graph with request-local keys and explicitly bounded write regions. */

import type { PreparedAttachment } from '../resources'
import type {
  EntryCreateInput,
  EntryRef,
  EntryTag,
  EntryType,
  PartRef,
  PartType,
  PartWorkType,
  WorkType,
} from './catalog'
import type { EntryUpdate } from './catalog'
import type { PartCreateFields, PartUpdate, VolumeChapter } from './parts'
import type { TagUpdate } from './organizers'
import type {
  CharacterRole,
  OrganizationRole,
  PersonRole,
  WorkCharacterBinding,
  PersonWorkBinding,
  OrganizationWorkBinding,
  StoredWorkRelationBinding,
  WorkRelationType,
  WorkCharacterUpdate,
  PersonWorkUpdate,
  OrganizationWorkUpdate,
  WorkRelationUpdate,
} from './relations'
import type { DirectoryCreateFields, FileCreateFields, FilePartType } from './holdings-values'
import type { FileWorkType } from './file-recognition'
import type { GameLaunchConfigCreate } from './game-configuration'

/** Keys address creates in this request only; they are not local IDs and never refer to an update node. */
export type GraphEntryRef<T extends EntryType = EntryType> = EntryRef<T> | { readonly key: string }
export type GraphPartRef<T extends PartType = PartType> = PartRef<T> | { readonly key: string }
export type GraphTagRef = { readonly id: string } | { readonly key: string }

export interface GraphTagMember {
  readonly tagId: GraphTagRef
  readonly note?: string | null
  readonly isSpoiler?: boolean
}

export type GraphTagChange =
  | { readonly type: 'replace'; readonly items: readonly GraphTagMember[] }
  | {
      readonly type: 'modify'
      readonly add?: readonly GraphTagMember[]
      readonly remove?: readonly GraphTagRef[]
    }

/** Seven ordinary creation branches, additionally named within this request and able to reference a newly created tag. */
export type GraphEntryCreate = {
  [K in EntryType]: Omit<EntryCreateInput<K>, 'tags'> & {
    readonly key: string
    readonly tags?: readonly GraphTagMember[]
  }
}[EntryType]

export type GraphPartCreate = {
  [K in PartType]: {
    readonly key: string
    readonly type: K
    readonly work: GraphEntryRef<PartWorkType<K>>
    readonly data: PartCreateFields<K>
    readonly completed?: boolean
  }
}[PartType]

export interface GraphTagCreate {
  readonly key: string
  readonly name: string
  readonly description?: string | null
  readonly isNsfw?: boolean
}

export type GraphTagUpdate = { readonly id: string } & TagUpdate

export interface GraphWorkCharacterAdd {
  readonly work: GraphEntryRef<WorkType>
  readonly character: GraphEntryRef<'character'>
  readonly role: CharacterRole | null
  readonly note?: string | null
  readonly isSpoiler?: boolean
}

export interface GraphPersonWorkAdd {
  readonly work: GraphEntryRef<WorkType>
  readonly person: GraphEntryRef<'person'>
  readonly character: GraphEntryRef<'character'> | null
  readonly role: PersonRole
  readonly note?: string | null
  readonly isSpoiler?: boolean
}

export interface GraphOrganizationWorkAdd {
  readonly work: GraphEntryRef<WorkType>
  readonly organization: GraphEntryRef<'organization'>
  readonly role: OrganizationRole
  readonly note?: string | null
  readonly isSpoiler?: boolean
}

export interface GraphWorkRelationAdd {
  readonly from: GraphEntryRef<WorkType>
  readonly to: GraphEntryRef<WorkType>
  readonly type: WorkRelationType
  readonly note?: string | null
}

/** Update preserves a real relation ID; only new endpoints may use graph keys, while baselines are complete saved facts. */
export interface GraphWorkCharacterUpdate {
  readonly id: string
  readonly changes: Partial<GraphWorkCharacterAdd>
  readonly expected?: NonNullable<WorkCharacterUpdate['expected']>
}

export interface GraphPersonWorkUpdate {
  readonly id: string
  readonly changes: Partial<GraphPersonWorkAdd>
  readonly expected?: NonNullable<PersonWorkUpdate['expected']>
}

export interface GraphOrganizationWorkUpdate {
  readonly id: string
  readonly changes: Partial<GraphOrganizationWorkAdd>
  readonly expected?: NonNullable<OrganizationWorkUpdate['expected']>
}

export interface GraphWorkRelationUpdate {
  readonly id: string
  readonly changes: Partial<GraphWorkRelationAdd>
  readonly expected?: NonNullable<WorkRelationUpdate['expected']>
}

/** Removal comparisons cover exactly the explicitly removed facts, never a later-expanded range or a graph revision. */
export interface WorkCharacterSnapshot {
  readonly id: string
  readonly binding: WorkCharacterBinding
  readonly note: string | null
  readonly isSpoiler: boolean
}

export interface PersonWorkSnapshot {
  readonly id: string
  readonly binding: PersonWorkBinding
  readonly note: string | null
  readonly isSpoiler: boolean
}

export interface OrganizationWorkSnapshot {
  readonly id: string
  readonly binding: OrganizationWorkBinding
  readonly note: string | null
  readonly isSpoiler: boolean
}

export interface WorkRelationSnapshot {
  readonly id: string
  readonly binding: StoredWorkRelationBinding
  readonly note: string | null
}

interface GraphRelationActions<Add, Update, Snapshot> {
  readonly add?: readonly Add[]
  readonly update?: readonly Update[]
  readonly remove?: readonly string[]
  readonly expected?: readonly Snapshot[]
}

export interface GraphVolumeChapter {
  readonly chapter: GraphPartRef<'comicChapter'>
  readonly numberLabel: string | null
}

export type GraphVolumeChapterChange =
  | { readonly type: 'replace'; readonly items: readonly GraphVolumeChapter[] }
  | {
      readonly type: 'modify'
      readonly add?: readonly GraphVolumeChapter[]
      readonly remove?: readonly GraphPartRef<'comicChapter'>[]
    }

/** Part ownership comes from GraphPartCreate.work, not writable workVolumes/workEpisodes relationship aliases. */
export interface GraphRelations {
  readonly workCharacters?: GraphRelationActions<
    GraphWorkCharacterAdd,
    GraphWorkCharacterUpdate,
    WorkCharacterSnapshot
  >

  readonly personWorks?: GraphRelationActions<
    GraphPersonWorkAdd,
    GraphPersonWorkUpdate,
    PersonWorkSnapshot
  >

  readonly organizationWorks?: GraphRelationActions<
    GraphOrganizationWorkAdd,
    GraphOrganizationWorkUpdate,
    OrganizationWorkSnapshot
  >

  readonly workRelations?: GraphRelationActions<
    GraphWorkRelationAdd,
    GraphWorkRelationUpdate,
    WorkRelationSnapshot
  >

  readonly entryTags?: readonly {
    readonly entry: GraphEntryRef
    readonly change: GraphTagChange
    readonly expected?: readonly EntryTag[]
  }[]

  readonly volumeChapters?: readonly {
    readonly volume: GraphPartRef<'comicVolume'>
    readonly change: GraphVolumeChapterChange
    readonly expected?: readonly VolumeChapter[]
  }[]
}

/** Initial local input has already been resolved; graph commit does not scan, fetch metadata or open content. */
export type GraphFileCreate<T extends FileWorkType> = Omit<FileCreateFields<T>, 'associations'> & {
  readonly associations?: readonly {
    readonly part: GraphPartRef<FilePartType<T>>
    readonly isPreferred?: boolean
  }[]
}

export interface GraphLocalContent {
  readonly game?: readonly {
    readonly work: GraphEntryRef<'game'>
    readonly directories?: readonly DirectoryCreateFields<'game'>[]
    readonly launchConfigs?: readonly GameLaunchConfigCreate[]
  }[]

  readonly anime?: readonly {
    readonly work: GraphEntryRef<'anime'>
    readonly directories?: readonly DirectoryCreateFields<'anime'>[]
    readonly files?: readonly GraphFileCreate<'anime'>[]
  }[]

  readonly comic?: readonly {
    readonly work: GraphEntryRef<'comic'>
    readonly directories?: readonly DirectoryCreateFields<'comic'>[]
    readonly files?: readonly GraphFileCreate<'comic'>[]
  }[]

  readonly novel?: readonly {
    readonly work: GraphEntryRef<'novel'>
    readonly directories?: readonly DirectoryCreateFields<'novel'>[]
    readonly files?: readonly GraphFileCreate<'novel'>[]
  }[]
}

/** Every region commits together. Empty graphs succeed with changed:false and empty maps; prepared alone is not a write. */
export interface LibraryWriteGraph {
  readonly entries?: {
    readonly create?: readonly GraphEntryCreate[]
    readonly update?: readonly EntryUpdate[]
  }

  readonly parts?: {
    readonly create?: readonly GraphPartCreate[]
    readonly update?: readonly PartUpdate[]
  }

  readonly tags?: {
    readonly create?: readonly GraphTagCreate[]
    readonly update?: readonly GraphTagUpdate[]
  }

  readonly relations?: GraphRelations
  readonly localContent?: GraphLocalContent

  readonly prepared?: readonly PreparedAttachment[]
}

/** Maps contain exactly this request's created keys; failures never return invented identities or partial maps. */
export interface LibraryWriteResult {
  readonly entries: Readonly<Record<string, EntryRef>>
  readonly parts: Readonly<Record<string, PartRef>>
  readonly tags: Readonly<Record<string, string>>
  readonly changed: boolean
}
