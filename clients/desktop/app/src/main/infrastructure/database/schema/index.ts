/** @fileoverview Exposes formal storage tables and the separately configured preference singleton. */

export { attachments } from './attachments/metadata'
export {
  entries,
  nameOrderState,
  games,
  animes,
  comics,
  novels,
  characters,
  persons,
  organizations,
  animeEpisodes,
  animeExtras,
  comicVolumes,
  comicChapters,
  novelVolumes,
  comicVolumeChapters,
  entryExternalIdentities,
  animeEpisodeExternalIdentities,
  animeExtraExternalIdentities,
  comicVolumeExternalIdentities,
  comicChapterExternalIdentities,
  novelVolumeExternalIdentities,
} from './catalog'
export {
  workCharacterLinks,
  workPersonLinks,
  workOrganizationLinks,
  workRelations,
} from './relations'
export { collections, collectionMembers, tags, entryTags } from './organizers'
export {
  animeFileRecognitionProfiles,
  comicFileRecognitionProfiles,
  novelFileRecognitionProfiles,
  gameDirectories,
  animeDirectories,
  comicDirectories,
  novelDirectories,
  gameLaunchConfigs,
  animeFiles,
  comicFiles,
  novelFiles,
  animeFileEpisodes,
  animeFileExtras,
  comicFileVolumes,
  comicFileChapters,
  novelFileVolumes,
  animePlaybackPreferences,
  comicReadingPreferences,
  novelReadingPreferences,
} from './holdings'
export {
  entryEvaluations,
  gameRecords,
  animeRecords,
  comicRecords,
  novelRecords,
  animeEpisodeRecords,
  animeExtraRecords,
  comicVolumeRecords,
  comicChapterRecords,
  novelVolumeRecords,
  workCompletionRecords,
  gamePlayActivity,
  animeWatchActivity,
  comicReadingActivity,
  novelReadingActivity,
} from './records'
export {
  notes,
  noteEntryLinks,
  gameAnnotations,
  animeAnnotations,
  comicAnnotations,
  novelAnnotations,
} from './notes'
export {
  entryDescriptionAttachments,
  animeEpisodeDescriptionAttachments,
  animeExtraDescriptionAttachments,
  comicVolumeDescriptionAttachments,
  comicChapterDescriptionAttachments,
  novelVolumeDescriptionAttachments,
  collectionDescriptionAttachments,
  tagDescriptionAttachments,
  noteContentAttachments,
  gameAnnotationContentAttachments,
  animeAnnotationContentAttachments,
  comicAnnotationContentAttachments,
  novelAnnotationContentAttachments,
} from './attachments/markdown-references'
export { gameSaveBackups, gameBackupRecoveries } from './backups'
export { metadataProfiles, scanConfigs, showcaseSections } from './configuration'
export { taskRuns, scanRuns } from './history'
export {
  themes,
  fonts,
  fontAttachments,
  onboardingState,
  extensionRepositories,
  installedExtensions,
  extensionStorage,
  extensionSecrets,
} from './application'
