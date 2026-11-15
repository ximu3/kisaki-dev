/** @fileoverview Exposes filesystem comparison, local-data validation and durable app-owned byte publication. */

export { normalizeAbsolutePath, comparePaths, assertLocalDataDirectory } from './paths'
export type { PathRelation } from './paths'
export { stageFile, storedFilePath, publishStoredFile, publishPath, syncDirectory } from './storage'
export type { StagedFile } from './storage'
export { parseArchivePath, createArchive, readArchive } from './archive'
export type { ArchiveLimits, ArchiveMember, ArchiveInput } from './archive'
