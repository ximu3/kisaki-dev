/** @fileoverview Publishes the complete library contract while keeping validation machinery and storage implementation private. */

import type { CallOptions, Disposable, NonEmptyArray } from './operations'
import type { EntryRef } from './library/catalog'
import type { EntriesApi, EntryMergeInput } from './library/entries'
import type { PartsApi } from './library/parts'
import type { RelationsApi } from './library/relations'
import type { CollectionsApi, TagsApi } from './library/organizers'
import type { NotesApi } from './library/notes'
import type { AnnotationsApi } from './library/annotations'
import type { ActivitiesApi } from './library/activities'
import type { CompletionsApi } from './library/completions'
import type { HoldingsApi } from './library/holdings'
import type { ShowcaseApi } from './library/showcase'
import type { LibraryWriteGraph, LibraryWriteResult } from './library/graph-values'
import type { LibraryInvalidation } from './library/changes'

export type {
  EntryType,
  WorkType,
  PartType,
  EntryRef,
  WorkRef,
  PartRef,
  PartWorkType,
  ExternalIdentity,
  ExternalLink,
  LanguageTag,
  Gender,
  BloodType,
  WorkStatus,
  ReleaseStatus,
  AnimeEpisodeType,
  AnimeExtraType,
  CharacterMeasure,
  EntryCommonFields,
  WorkFields,
  SerialWorkFields,
  CharacterFields,
  EntrySpecificFields,
  EntryFields,
  Evaluation,
  WorkRecord,
  CompletionFields,
  EntryTag,
  EntryCollection,
  EntryTagInput,
  EntryCollectionInput,
  EntryTagChange,
  EntryCollectionChange,
  EntryChanges,
  EntryExpected,
  EntryCreateInput,
  EntryUpdate,
  EntryDetails,
} from './library/catalog'
export {
  sameExternalIdentity,
  parseEntryRef,
  parseWorkRef,
  parsePartRef,
  parseExternalIdentity,
  parseExternalIdentities,
  parseLanguageTag,
  parseEntryTagChange,
  parseEntryCollectionChange,
  isWorkType,
  parseEntryCreate,
  parseEntryUpdate,
  parseEntryRefs,
  entryTypes,
  workTypes,
  partTypes,
} from './library/catalog'

export type {
  EvaluationUpdate,
  WorkStatusUpdate,
  EntryMergeInput,
  EntriesApi,
} from './library/entries'
export {
  parseEvaluationUpdate,
  parseWorkStatusUpdate,
  parseEntryUpdates,
  parseEntryMergeInput,
  parseEntryDetails,
} from './library/entries'

export type {
  EntryScope,
  Presence,
  NumberTest,
  TextTest,
  SetTest,
  EnumTest,
  DateTest,
  BirthdayTest,
  InstantTest,
  PartCountMeasure,
  PartCountScope,
  CharacterQualifier,
  EntryRelationCondition,
  EntryCondition,
  EntryRule,
  EntrySortField,
  EntrySort,
  EntryQuery,
  PartCounts,
  EntryProjectionByType,
  EntryProjectionField,
  EntryListItem,
  EntryGroupKey,
  EntryListOptions,
  EntryLocateOptions,
  EntryListResult,
  EntryLocateResult,
  EntryGroupResult,
  EntryGroupsResult,
  EntrySelection,
  QueryReferenceLabel,
  DynamicRules,
} from './library/query-values'

export {
  parseEntryCondition,
  parsePartCountScope,
  getEntryConditionTypes,
  parseEntryRule,
  parseEntrySort,
  parseEntryQuery,
  parseEntryListOptions,
  parseEntryLocateOptions,
  entryLocateOffset,
  parseEntrySelection,
  parseQueryReferenceLabels,
  parseDynamicRules,
  entryFieldTypes,
  entrySortFields,
  entryProjectionFields,
} from './library/query'

export {
  parseEntryListItem,
  parseEntryListResult,
  parseEntryLocateResult,
  parseEntryGroupsResult,
} from './library/projections'

export type {
  PartCommonFields,
  PartSpecificFields,
  PartFields,
  PartCreateFields,
  PartCreate,
  PartUpdate,
  PartDetails,
  PartQuery,
  PartKindTarget,
  PartKindChange,
  VolumeChapter,
  VolumeChapterChange,
  PartsApi,
  PartOrderScope,
  VolumeChaptersApi,
} from './library/parts'
export {
  partWorkType,
  parsePartCreate,
  parsePartUpdate,
  parsePartKindChange,
  parsePartQuery,
  parseVolumeChapterChange,
} from './library/parts'

export type {
  CharacterRole,
  PersonRole,
  OrganizationRole,
  CharacterPersonRole,
  PersonRoleFor,
  OrganizationRoleFor,
  RelationProperties,
  WorkCharacterBinding,
  PersonWorkBinding,
  OrganizationWorkBinding,
  WorkRelationType,
  StoredWorkRelationType,
  WorkRelationBinding,
  StoredWorkRelationBinding,
  WorkCharacter,
  PersonWork,
  OrganizationWork,
  WorkRelation,
  WorkCharacterCreate,
  PersonWorkCreate,
  OrganizationWorkCreate,
  WorkRelationCreate,
  WorkCharacterUpdate,
  PersonWorkUpdate,
  OrganizationWorkUpdate,
  WorkRelationUpdate,
  WorkCharacterScope,
  PersonWorkScope,
  OrganizationWorkScope,
  WorkRelationScope,
  RelationsApi,
} from './library/relations'
export {
  canUsePersonRole,
  canUseOrganizationRole,
  reverseWorkRelationType,
  normalizeWorkRelation,
  parseWorkCharacterCreate,
  parseWorkCharacterBinding,
  parsePersonWorkBinding,
  parseOrganizationWorkBinding,
  parseStoredWorkRelationBinding,
  parsePersonWorkCreate,
  parseOrganizationWorkCreate,
  parseWorkRelationCreate,
  parseWorkCharacterUpdate,
  parsePersonWorkUpdate,
  parseOrganizationWorkUpdate,
  parseWorkRelationUpdate,
  characterRoles,
  personRoles,
  organizationRoles,
  workRelationTypes,
} from './library/relations'

export type {
  CollectionFields,
  TagFields,
  Collection,
  Tag,
  CollectionListItem,
  TagListItem,
  OrganizerSort,
  CollectionQuery,
  TagQuery,
  CollectionMember,
  CollectionMemberInput,
  TagEntry,
  TagEntryInput,
  CollectionMemberChange,
  TagEntryChange,
  CollectionCreate,
  CollectionUpdate,
  TagCreate,
  TagUpdate,
  OrganizerMerge,
  OrganizerMergeResult,
  CollectionMembersApi,
  TagEntriesApi,
  CollectionsApi,
  TagsApi,
} from './library/organizers'
export {
  parseCollectionQuery,
  parseTagQuery,
  parseCollectionCreate,
  parseCollectionUpdate,
  parseTagCreate,
  parseTagUpdate,
  parseOrganizerMerge,
  parseCollectionMemberChange,
  parseTagEntryChange,
} from './library/organizers'

export type {
  NoteFields,
  Note,
  NoteSummary,
  NoteCreate,
  NoteUpdate,
  NoteQuery,
  NoteEntryChange,
  NoteOrderScope,
  NoteEntriesApi,
  NotesApi,
} from './library/notes'
export {
  parseNoteCreate,
  parseNoteUpdate,
  parseNoteQuery,
  parseNoteEntryChange,
} from './library/notes'

export type {
  AnnotationRef,
  AnnotationTargetByType,
  Annotation,
  AnnotationCreate,
  AnnotationUpdate,
  AnnotationScope,
  AnnotationQuery,
  AnnotationPositionHint,
  AnnotationSummary,
  AnnotationLocationItem,
  AnnotationLocationResult,
  AnnotationsApi,
} from './library/annotations'
export {
  parseAnnotationRef,
  parseAnnotationQuery,
  parseAnnotationCreate,
  parseAnnotationUpdate,
} from './library/annotations'

export type {
  ActivityTiming,
  ActivityContextByType,
  ActivityCreate,
  Activity,
  ActivityUpdate,
  InstantRange,
  ActivityFilter,
  ActivityQuery,
  ActivityStatistics,
  ActivitiesApi,
} from './library/activities'
export {
  parseActivityTiming,
  parseActivityCreate,
  parseActivityUpdate,
  activityDurationInRange,
  parseActivityContextNames,
} from './library/activities'

export type {
  WorkCompletion,
  CompletionCreate,
  CompletionCreateItem,
  CompletionUpdate,
  WorkStatisticsScope,
  CompletionStatistics,
  CompletionsApi,
} from './library/completions'
export {
  parseCompletionCreate,
  parseCompletionUpdate,
  parseCompletionCreateMany,
  parseRecordCurrentMany,
} from './library/completions'

export type {
  DirectoryDiscoveryDefinition,
  ContentDirectory,
  DirectoryCreateFields,
  DirectoryUpdate,
  FileAssociationMode,
  FilePartType,
  FileAssociation,
  FileAssociationInput,
  FileAssociationChange,
  FileAssociationEdit,
  FileAvailability,
  AnimeFileMetadata,
  ReadingFileMetadata,
  FileTrackSelection,
  FilePlaybackChoices,
  FilePreferencesByType,
  FilePreferenceChangeByType,
  HeldFile,
  FileCreateFields,
  FileQuery,
  PreferredFileScope,
  PreferredFileInput,
  PreferredPartFile,
  LocalContentInput,
  LocalContentRegistrationOptions,
  LocalContentRegistrationResult,
  FileRecognitionSource,
  FileRecognitionResult,
  HoldingsRefreshResult,
  FileReidentificationResult,
  DirectoryRelocationInput,
  RelocatedPathTarget,
  HoldingsRelocationResult,
  FileMergeInput,
  FileMergeResult,
} from './library/holdings-values'

export type {
  ContentDirectoriesApi,
  UsagePreferenceTarget,
  HoldingsPreferencesApi,
  FilePlaybackChoicesApi,
  HeldFilesApi,
  HoldingsApi,
} from './library/holdings'
export {
  getDirectoryDiscoveryDefaults,
  parseDirectoryDiscoveryDefinition,
  parseDirectoryCreateFields,
  parseDirectoryUpdate,
  parseFileCreateFields,
  initialFileAssociationMode,
  parseFileAssociationChange,
  parseFileAssociationEdit,
  parseFileAssociationModeChange,
  parseFileQuery,
  parseLocalContentInput,
  parseLocalContentRegistrationOptions,
  parseLocalContentRegistrationResult,
  parseFileMergeInput,
  parseFileTrackSelection,
  parseFilePlaybackChoicesUpdate,
  parsePreferredFileInput,
  parsePreferredPartFiles,
  parseDirectoryRelocationInput,
} from './library/holdings'

export type {
  GameLaunchTarget,
  GameMonitor,
  GameLaunchDefinition,
  GameLaunchConfig,
  GameLaunchConfigFields,
  GameLaunchConfigCreate,
  GameLaunchConfigUpdate,
  GameLaunchConfigsApi,
} from './library/game-configuration'
export {
  parseGameLaunchDefinition,
  hasGameLaunchInputs,
  getGameLaunchDefaults,
  parseGameLaunchConfigCreate,
  parseGameLaunchConfigUpdate,
  requireGameLaunchInputs,
} from './library/game-configuration'

export type {
  GameBackupSource,
  GameBackupReason,
  GameBackup,
  GameBackupIssue,
  GameBackupCreateResult,
  GameBackupCreateInput,
  GameBackupArchiveEntry,
  GameBackupArchiveManifest,
  GameBackupTreeRow,
  GameBackupRestoreInput,
  RecoveryLocation,
  RecoveryAction,
  RecoveryResolution,
  GameBackupRestoreResult,
  GameBackupRecoveryManifest,
  GameBackupRecoveryProgress,
  GameBackupRecovery,
  RecoveryLocationObservation,
  GameBackupRecoveryInspection,
  GameBackupRecoveriesApi,
  GameBackupsApi,
} from './library/backups'

export {
  encodeGameBackupTree,
  gameBackupTreeDigest,
  parseGameBackupArchiveManifest,
  parseGameBackupArchiveJson,
  parseGameBackupSource,
  parseGameBackupCreateInput,
  parseGameBackupRestoreInput,
  parseGameBackupRecoveryManifest,
  parseGameBackupRecoveryProgress,
  gameBackupRecoveryBasis,
  parseGameBackupRestoreResult,
} from './library/backup-formats'

export type {
  FileWorkType,
  FileNumberValue,
  FileNumberOutput,
  NumberedPartOutput,
  ComicVolumeScopeOutput,
  AnimeFileTarget,
  ComicFileTarget,
  NovelFileTarget,
  FileTargetByType,
  FileRecognitionRule,
  FileRecognitionDefinition,
  FileRecognitionProfile,
  FileRecognitionProfileFields,
  FileRecognitionPreset,
  FileRecognitionProfilesApi,
} from './library/file-recognition'
export {
  parseFileTarget,
  parseFileRecognitionDefinition,
  parseFileRecognitionDefinitionShape,
  parseFileRecognitionProfileUpdate,
  fileNumberKey,
  applyFileNumberOffset,
  expandFileNumberRange,
} from './library/file-recognition'

export type {
  FileNumberCondition,
  NumberedPartCondition,
  ComicVolumeScopeCondition,
  FileConditionByType,
  FileRuleInterpretation,
} from './library/file-recognition-output'
export { expandFileTarget, interpretFileRules } from './library/file-recognition-output'

export type {
  TextEncoding,
  ReadingAnchorByType,
  ReadingAnchor,
  ReadingPageRef,
  ReadingPosition,
  ReadingTextSelection,
  ReadingPageRegion,
  ReadingAnnotationLocation,
  PlaybackAnnotationLocation,
  ReadingPositionInput,
  PlaybackPositionInput,
} from './library/reading'
export {
  parseTextEncoding,
  parseReadingAnchor,
  parseReadingPageRef,
  parseReadingPosition,
  parseReadingTextSelection,
  parseReadingPageRegion,
  parseReadingAnnotationLocation,
  parsePlaybackAnnotationLocation,
  textEncodings,
} from './library/reading'

export type { ReorderInput, MoveInput } from './library/ordering'
export {
  parseReorderInput,
  parseMoveInput,
  reorderSubset,
  moveWithinOrder,
} from './library/ordering'

export type {
  GraphEntryRef,
  GraphPartRef,
  GraphTagRef,
  GraphTagMember,
  GraphTagChange,
  GraphEntryCreate,
  GraphPartCreate,
  GraphTagCreate,
  GraphTagUpdate,
  GraphWorkCharacterAdd,
  GraphPersonWorkAdd,
  GraphOrganizationWorkAdd,
  GraphWorkRelationAdd,
  GraphWorkCharacterUpdate,
  GraphPersonWorkUpdate,
  GraphOrganizationWorkUpdate,
  GraphWorkRelationUpdate,
  WorkCharacterSnapshot,
  PersonWorkSnapshot,
  OrganizationWorkSnapshot,
  WorkRelationSnapshot,
  GraphVolumeChapter,
  GraphVolumeChapterChange,
  GraphRelations,
  GraphFileCreate,
  GraphLocalContent,
  LibraryWriteGraph,
  LibraryWriteResult,
} from './library/graph-values'

export { parseLibraryWriteGraph, parseLibraryWriteResult } from './library/graph'

export type {
  ShowcaseQuery,
  ShowcaseFields,
  ShowcaseSection,
  ShowcaseSectionRef,
  ShowcaseChanges,
  ShowcaseChangeResult,
  ShowcasePreset,
  ShowcaseApi,
} from './library/showcase'
export {
  parseShowcaseQuery,
  parseShowcaseFields,
  parseShowcaseChanges,
  getShowcasePresets,
} from './library/showcase'

export type {
  EntryIdentitySnapshot,
  PartIdentitySnapshot,
  RelationIdentitySnapshot,
  HoldingsChangeContext,
  LibraryChange,
  LibraryChanged,
  LibraryInvalidationArea,
  LibraryInvalidation,
} from './library/changes'
export {
  parseRelationIdentitySnapshot,
  parseLibraryChange,
  parseLibraryChanged,
  parseLibraryInvalidation,
  libraryInvalidationAreas,
} from './library/changes'

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
