/** @fileoverview Exposes the finite Node author surface and instance-owned private storage. */

export type {
  ExtensionLibraryApi,
  ExtensionMetadataApi,
  ExtensionScannerApi,
  ExtensionSessionsApi,
  ThemeContribution,
  TranslationContribution,
  ExtensionPageDefinition,
  ExtensionUiApi,
  ExtensionAppearanceApi,
  ExtensionI18nApi,
  ExtensionEventsApi,
  ExtensionIdentity,
  ExtensionPaths,
  ExtensionContext,
  ExtensionModule,
} from './context'
export type {
  StoredValue,
  SecretState,
  StorageWriteOptions,
  StorageMutation,
  StorageCommit,
  StorageCommitResult,
  StorageApi,
} from './storage'
export { parseStorageCommit } from './storage'
export type { MetadataProvider, FieldProcessor, WorkRecognizer } from './context'
