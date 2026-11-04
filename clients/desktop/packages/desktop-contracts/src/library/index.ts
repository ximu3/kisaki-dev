/** @fileoverview Publishes the library capability contract. */

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
  FileWorkType,
} from './catalog'

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
} from './catalog'

export type { EvaluationUpdate, WorkStatusUpdate, EntryMergeInput, EntriesApi } from './entries'

export {
  parseEvaluationUpdate,
  parseWorkStatusUpdate,
  parseEntryUpdates,
  parseEntryMergeInput,
  parseEntryDetails,
} from './entries'

export type { EntryScope, EntryQuery, QueryReferenceLabel, DynamicRules } from './query/definition'
export type {
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
} from './query/conditions'

export type { EntrySortField, EntrySort } from './query/sort'

export type {
  PartCounts,
  EntryProjectionByType,
  EntryProjectionField,
  EntryListItem,
} from './query/projections'

export type {
  EntryGroupKey,
  EntryListOptions,
  EntryLocateOptions,
  EntryListResult,
  EntryLocateResult,
  EntryGroupResult,
  EntryGroupsResult,
} from './query/listing'

export type { EntrySelection } from './query/selection'

export {
  parseEntryCondition,
  parsePartCountScope,
  getEntryConditionTypes,
  parseEntryRule,
} from './query/conditions'

export { parseEntrySort, entrySortFields } from './query/sort'
export { parseEntryQuery, parseQueryReferenceLabels, parseDynamicRules } from './query/definition'
export {
  parseEntryListOptions,
  parseEntryLocateOptions,
  entryLocateOffset,
  parseEntryListResult,
  parseEntryLocateResult,
  parseEntryGroupsResult,
} from './query/listing'

export { parseEntrySelection } from './query/selection'

export { entryFieldTypes } from './query/fields'

export { entryProjectionFields, parseEntryListItem } from './query/projections'

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
} from './parts'

export {
  partWorkType,
  parsePartCreate,
  parsePartUpdate,
  parsePartKindChange,
  parsePartQuery,
  parseVolumeChapterChange,
} from './parts'

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
} from './relations'

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
  canUseWorkRelation,
} from './relations'

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
} from './organizers'

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
} from './organizers'

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
} from './notes'

export { parseNoteCreate, parseNoteUpdate, parseNoteQuery, parseNoteEntryChange } from './notes'

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
} from './annotations'

export {
  parseAnnotationRef,
  parseAnnotationQuery,
  parseAnnotationCreate,
  parseAnnotationUpdate,
} from './annotations'

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
} from './activities'

export {
  parseActivityTiming,
  parseActivityCreate,
  parseActivityUpdate,
  parseActivityContextNames,
} from './activities'

export type {
  WorkCompletion,
  CompletionCreate,
  CompletionCreateItem,
  CompletionUpdate,
  WorkStatisticsScope,
  CompletionStatistics,
  CompletionsApi,
} from './completions'

export {
  parseCompletionCreate,
  parseCompletionUpdate,
  parseCompletionCreateMany,
} from './completions'

export type {
  DirectoryDiscoveryDefinition,
  ContentDirectory,
  DirectoryCreateFields,
  DirectoryUpdate,
  DirectoryRelocationInput,
  RelocatedPathTarget,
  HoldingsRelocationResult,
  ContentDirectoriesApi,
} from './holdings/directories'

export type {
  FileAssociationMode,
  FilePartType,
  FileAssociation,
  FileAssociationInput,
  FileAssociationChange,
  FileAssociationEdit,
} from './holdings/associations'

export type {
  FileAvailability,
  AnimeFileMetadata,
  ReadingFileMetadata,
  HeldFile,
  FileCreateFields,
  FileQuery,
  FileMergeInput,
  FileMergeResult,
  HeldFilesApi,
} from './holdings/files'

export type {
  FileTrackSelection,
  FilePlaybackChoices,
  FilePreferencesByType,
  FilePreferenceChangeByType,
  PreferredFileScope,
  PreferredFileInput,
  PreferredPartFile,
  UsagePreferenceTarget,
  HoldingsPreferencesApi,
  FilePlaybackChoicesApi,
} from './holdings/preferences'

export type {
  LocalContentInput,
  LocalContentRegistrationOptions,
  LocalContentRegistrationResult,
  HoldingsRefreshResult,
} from './holdings/local-content'

export type {
  FileRecognitionSource,
  FileRecognitionResult,
  FileReidentificationResult,
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
  FileConditionByType,
  FileNumberCondition,
  NumberedPartCondition,
  ComicVolumeScopeCondition,
} from './holdings/file-recognition'

export type { HoldingsApi } from './holdings/api'
export {
  parseDirectoryDiscoveryDefinition,
  parseDirectoryCreateFields,
  parseDirectoryUpdate,
  parseDirectoryRelocationInput,
} from './holdings/directories'

export { parseFileCreateFields, parseFileQuery, parseFileMergeInput } from './holdings/files'
export {
  parseFileAssociationChange,
  parseFileAssociationEdit,
  parseFileAssociationModeChange,
} from './holdings/associations'

export {
  parseLocalContentInput,
  parseLocalContentRegistrationOptions,
  parseLocalContentRegistrationResult,
} from './holdings/local-content'

export {
  parseFileTrackSelection,
  parseFilePlaybackChoicesUpdate,
  parsePreferredFileInput,
  parsePreferredPartFiles,
} from './holdings/preferences'

export type {
  GameLaunchTarget,
  GameMonitor,
  GameLaunchDefinition,
  GameLaunchConfig,
  GameLaunchConfigFields,
  GameLaunchConfigCreate,
  GameLaunchConfigUpdate,
  GameLaunchConfigsApi,
} from './holdings/game-configuration'

export {
  parseGameLaunchDefinition,
  parseGameLaunchConfigCreate,
  parseGameLaunchConfigUpdate,
} from './holdings/game-configuration'

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
} from './holdings/backups'

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
} from './holdings/backup-formats'

export {
  parseFileTarget,
  parseFileRecognitionDefinition,
  parseFileRecognitionDefinitionShape,
  parseFileRecognitionProfileUpdate,
  fileNumberKey,
} from './holdings/file-recognition'

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
} from './reading'

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
} from './reading'

export type { ReorderInput, MoveInput } from './ordering'

export { parseReorderInput, parseMoveInput } from './ordering'

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
} from './graph/nodes'

export type {
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
} from './graph/relations'

export type { GraphFileCreate, GraphLocalContent } from './graph/local-content'

export type { LibraryWriteGraph, LibraryWriteResult } from './graph/write'

export { parseLibraryWriteGraph, parseLibraryWriteResult } from './graph/write'

export type {
  ShowcaseQuery,
  ShowcaseFields,
  ShowcaseSection,
  ShowcaseSectionRef,
  ShowcaseChanges,
  ShowcaseChangeResult,
  ShowcasePreset,
  ShowcaseApi,
} from './showcase'

export { parseShowcaseQuery, parseShowcaseFields, parseShowcaseChanges } from './showcase'

export type {
  EntryIdentitySnapshot,
  PartIdentitySnapshot,
  RelationIdentitySnapshot,
  HoldingsChangeContext,
  LibraryChange,
  LibraryChanged,
  LibraryInvalidationArea,
  LibraryInvalidation,
} from './changes'

export {
  parseRelationIdentitySnapshot,
  parseLibraryChange,
  parseLibraryChanged,
  parseLibraryInvalidation,
  libraryInvalidationAreas,
} from './changes'

export type { LibraryApi } from './api'
