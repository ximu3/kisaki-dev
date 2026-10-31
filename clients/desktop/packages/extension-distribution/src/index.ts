/** @fileoverview Public extension distribution entry for static localized metadata. */

export type { LocalizedText } from './metadata'
export { parseLanguageTag, parseLocalizedText, resolveLocalizedText } from './metadata'
export type { LanguageTag } from './metadata'
export {
  parseExtensionId,
  parseLocalId,
  parsePackagePath,
  parseContributionId,
  formatContributionId,
} from './identity'
export {
  extensionTargets,
  extensionCategories,
  manifestSchemaVersion,
  parseExtensionManifest,
  validateExtensionManifest,
} from './manifest'
export type {
  ExtensionManifest,
  ExtensionRequirements,
  ExtensionTarget,
  ExtensionCategory,
  ExtensionAuthor,
} from './manifest'
export { registrySchemaVersion, parseExtensionRegistry, resolveDistributionFile } from './registry'
export type {
  ExtensionRegistry,
  RegistryExtension,
  ExtensionRelease,
  ExtensionArtifact,
  DistributionFile,
} from './registry'
export { checkExtensionCompatibility, selectExtensionRelease } from './compatibility'
export type {
  ExtensionEnvironment,
  ExtensionCompatibility,
  CompatibilityIssue,
} from './compatibility'
export { DistributionError } from './validation'
