/** @fileoverview Exposes complete library values and operations without database or application dependencies. */
export type {
  EntryType,
  WorkType,
  PartType,
  EntryRef,
  WorkRef,
  PartRef,
  ExternalIdentity,
  EntryIdentifier,
} from './identity'
export {
  parseEntryRef,
  parseWorkRef,
  parsePartRef,
  parseExternalIdentity,
  parseEntryIdentifier,
  externalIdentityKey,
  entryTypes,
  workTypes,
  partTypes,
} from './identity'
export type {
  WorkStatus,
  ReleaseStatus,
  Gender,
  BloodType,
  CharacterMeasurement,
  ExternalLink,
  Evaluation,
  WorkRecord,
  WorkSummary,
  CommonEntryMetadata,
  WorkMetadata,
  EntryMetadataByType,
  EntryDetails,
  EntryTag,
  EntryCollection,
  EntryTagChange,
  EntryCollectionChange,
  EntryCreateInput,
  EntryUpdateInput,
  EntryUpdate,
} from './catalog'
export {
  parseEntryCreate,
  parseEntryUpdate,
  parseEvaluationUpdate,
  readAliases,
  readExternalLinks,
  parseCharacterMeasurement,
  workStatuses,
  releaseStatuses,
  genders,
  bloodTypes,
} from './catalog'
export type {
  AnimeEpisodeType,
  AnimeExtraType,
  PartWorkType,
  CommonPartMetadata,
  PartMetadataByType,
  PartCreateFields,
  PartDetails,
  PartCreateInput,
  PartUpdateInput,
  PartUpdate,
  PartScope,
  AnimePartTarget,
  PartKindChangeInput,
  PartsApi,
} from './parts'
export {
  parsePartCreate,
  parsePartUpdate,
  parsePartKindChange,
  animeEpisodeTypes,
  animeExtraTypes,
} from './parts'
export type {
  CharacterRole,
  PersonRole,
  OrganizationRole,
  CanonicalWorkRelationType,
  WorkRelationType,
  WorkCharacterBinding,
  PersonWorkBinding,
  OrganizationWorkBinding,
  WorkRelationBinding,
  RelationBindings,
  RelationKind,
  RelationRef,
  RelationSnapshot,
  RelationCreate,
  RelationUpdate,
  RelationScopes,
  RelationApi,
  RelationsApi,
} from './relations'
export {
  isPersonRoleAllowed,
  isOrganizationRoleAllowed,
  isWorkRelationAllowed,
  normalizeWorkRelation,
  parseRelationBinding,
  parseRelationUpdate,
  characterRoles,
  personRoles,
  organizationRoles,
  workRelationTypes,
  canonicalWorkRelationTypes,
  personRoleWorkTypes,
  organizationRoleWorkTypes,
  characterScopedPersonRoles,
} from './relations'
export type { OrderChange, MoveInput } from './ordering'
export { parseOrderChange, parseMoveInput } from './ordering'
export type {
  EntryScope,
  PartCountScope,
  PartCountMeasure,
  CharacterCondition,
  EntryRelationCondition,
  EntryCondition,
  EntryRule,
  EntrySortField,
  EntrySort,
  EntryQuery,
  EntryGroupResult,
  EntryGroupsResult,
  EntrySelection,
} from './queries'
export {
  parseEntryQuery,
  parseEntryCondition,
  parseEntrySelection,
  calculateLocateOffset,
  partCountMeasures,
  entrySortFields,
} from './queries'
export type {
  EntryGroupKey,
  Presence,
  NumberTest,
  SetTest,
  EnumTest,
  TextTest,
  DateTest,
  MonthDayTest,
} from './query-values'
export { entryFieldTypes } from './query-fields'
export type {
  EntryProjectionField,
  PartCounts,
  EntryProjectionByType,
  EntryListItem,
  EntryListOptions,
  EntryLocateOptions,
  EntryListResult,
  EntryLocateResult,
} from './projections'
export {
  parseEntryListOptions,
  parseEntryLocateOptions,
  parseEntryListItem,
  entryProjectionFields,
} from './projections'
export type {
  TextEncoding,
  ReadingAnchor,
  ReadingPageRef,
  ReadingPosition,
  ReadingPositionInput,
  ReadingTextSelection,
  ReadingPageRegion,
  ReadingAnnotationLocation,
} from './reading'
export {
  parseReadingAnchor,
  parseReadingPosition,
  parseReadingPositionInput,
  parseReadingTextSelection,
  parseReadingPageRegion,
  parseReadingAnnotationLocation,
  textEncodings,
} from './reading'
export type { PlaybackPositionInput, PlaybackAnnotationLocation } from './playback'
export { parsePlaybackAnnotationLocation, parsePlaybackPositionInput } from './playback'
export type {
  AnnotationRef,
  AnnotationTargets,
  Annotation,
  AnnotationCreate,
  AnnotationUpdate,
  AnnotationScope,
  AnnotationQuery,
  AnnotationPositionHint,
  AnnotationSummary,
  AnnotationListResult,
  AnnotationLocationItem,
  AnnotationLocationResult,
  AnnotationsApi,
} from './annotations'
export {
  parseAnnotationRef,
  parseAnnotationCreate,
  parseAnnotationUpdate,
  parseAnnotationQuery,
} from './annotations'
export type {
  Note,
  NoteSummary,
  NoteCreate,
  NoteUpdate,
  NoteQuery,
  NoteOrderScope,
  NoteEntriesChange,
  NotesApi,
} from './notes'
export { parseNoteCreate, parseNoteUpdate } from './notes'
export type {
  CompletionRecord,
  CompletionCreate,
  CompletionCreateItem,
  CompletionUpdate,
  CompletionStatisticsQuery,
  CompletionStatistics,
  CompletionsApi,
} from './completions'
export { parseCompletionCreate, parseCompletionBatch, parseCompletionUpdate } from './completions'
export type {
  QueryReferenceLabel,
  DynamicCollectionRules,
  Collection,
  CollectionSummary,
  CollectionMember,
  CollectionMembersChange,
  CollectionCreate,
  CollectionUpdate,
  CollectionQuery,
  Tag,
  TagSummary,
  TagCreate,
  TagUpdate,
  TagQuery,
  TagEntry,
  TagEntriesChange,
  OrganizerMergeInput,
  OrganizerMergeResult,
  CollectionsApi,
  TagsApi,
} from './organizers'
export {
  parseCollectionQuery,
  parseTagQuery,
  parseDynamicCollectionRules,
  parseTagCreate,
  parseTagUpdate,
  normalizeTagNameKey,
  parseOrganizerMerge,
} from './organizers'
export type {
  ActivityInterval,
  ActivityContextByType,
  ActivityCreate,
  Activity,
  ActivityUpdate,
  ActivityQuery,
  ActivityStatistics,
  ActivitiesApi,
} from './activities'
export { parseActivityCreate, parseActivityUpdate, allocateActivityDuration } from './activities'
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
  FileRecognitionProfileChanges,
  FileRecognitionProfilesApi,
} from './file-recognition'
export {
  parseFileRecognitionDefinition,
  validateFileTargetReferences,
  applyFileNumberOffset,
  fileNumberLabelsEqual,
} from './file-recognition'
export type {
  GameLaunchTarget,
  GameMonitoringRule,
  GameLaunchConfigFields,
  GameLaunchConfig,
  GameLaunchConfigUpdate,
  GameLaunchConfigsApi,
} from './launch-configs'
export {
  parseGameLaunchConfigFields,
  parseGameLaunchConfigUpdate,
  createGameLaunchConfigDraft,
} from './launch-configs'
export type {
  DirectoryDiscoveryDefinition,
  FileAssociationMode,
  LocalContentInput,
  LocalContentRegistrationResult,
  WorkDirectory,
  DirectoryCreate,
  DirectoryChanges,
  FileAvailability,
  FileTrackSelection,
  CustomPreferences,
  FileAssociation,
  WorkFile,
  FileAssociationChange,
  HoldingsReport,
  FileReidentificationResult,
  RelocationResult,
  DirectoriesApi,
  FilesApi,
  HoldingsApi,
} from './holdings'
export {
  parseDirectoryDiscoveryDefinition,
  createDefaultDirectoryDiscovery,
  parseLocalContentInput,
} from './holdings'
export type {
  GameBackupSource,
  GameBackupReason,
  GameBackupIssue,
  GameBackupCreateResult,
  GameBackup,
  GameBackupArchiveEntry,
  GameBackupArchiveManifest,
  GameBackupTreeRow,
  RecoveryLocation,
  RecoveryAction,
  RecoveryResolution,
  GameBackupRestoreInput,
  GameBackupRestoreResult,
  GameBackupRecoveryManifest,
  RecoveryLocationObservation,
  GameBackupRecoveryInspection,
  RecoveryOutcome,
  GameBackupRecovery,
  GameBackupRecoveryDetails,
  GameBackupRecoveriesApi,
  GameBackupsApi,
} from './backups'
export {
  encodeGameBackupTree,
  calculateGameBackupTreeDigest,
  parseGameBackupArchiveManifest,
  readGameBackupArchiveManifest,
  parseGameBackupRecoveryManifest,
} from './backups'
export type {
  GraphEntryRef,
  GraphPartRef,
  GraphTagRef,
  GraphEntryCreate,
  GraphPartCreate,
  GraphTagCreate,
  GraphRelationBindings,
  GraphRelationAdd,
  GraphRelationChanges,
  GraphEntryTag,
  GraphEntryTagChange,
  GraphVolumeChapter,
  VolumeChapter,
  GraphVolumeChapterChange,
  GraphRelations,
  GraphFileCreate,
  GraphLocalContent,
  LibraryWriteGraph,
  LibraryWriteResult,
} from './graph'
export { parseLibraryWriteGraph } from './graph'
export type {
  ShowcaseQuery,
  ShowcaseConfiguration,
  ShowcaseSection,
  ShowcaseChanges,
  ShowcaseChangeResult,
  ShowcasePresetId,
  ShowcasePreset,
  ShowcaseApi,
} from './showcase'
export {
  parseShowcaseQuery,
  parseShowcaseConfiguration,
  parseShowcaseChanges,
  createShowcaseDraft,
  createShowcasePresets,
  showcasePresetIds,
} from './showcase'
export type {
  EntryIdentitySnapshot,
  PartIdentitySnapshot,
  LibraryChange,
  LibraryChangedEvent,
} from './changes'
export type { EntriesApi, VolumeChaptersApi, LibraryApi } from './api'
export type { FileRecognitionPreset } from './file-recognition'
export type {
  FilePlaybackSettingChanges,
  UsagePreferencesByType,
  UsagePreferenceChangesByType,
  CustomPreferenceUpdate,
  HoldingsPreferencesApi,
} from './holdings'
export { parseFileTrackSelection, parseFilePlaybackSettingsUpdate } from './holdings'
