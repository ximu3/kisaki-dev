import type { CompatibilityDeclaration } from '../compatibility'
import type { ExtensionMetadata, LocalizedText } from '../metadata'

/** Flat registry format version; independent of package and extension API versions. */
export const registrySchemaVersion = 1

/**
 * The URL, byte length and SHA-256 digest of a downloadable resource.
 *
 * Raw references preserve signed URL spelling; verified references resolve against the final index
 * response URL.
 */
export interface FileReference {
  readonly url: string
  /** Original byte count, not decoded text length or transfer-encoded length. */
  readonly size: number
  /** Lowercase hexadecimal digest of the complete original bytes. */
  readonly sha256: string
}

/**
 * Byte reference and compatibility requirements for one .kisx artifact shared by its target set.
 */
export interface RegistryArtifact extends FileReference, CompatibilityDeclaration {
  readonly license?: string
}

/**
 * Publication details, localized notes and target-specific artifacts for one release.
 *
 * At least one artifact is required, and each target belongs to only one artifact.
 */
export interface RegistryRelease {
  readonly version: string
  /** First publication time in UTC milliseconds, unchanged by note corrections. */
  readonly publishedAt: number

  readonly defaultLocale: string
  readonly releaseNotes?: LocalizedText
  readonly readme?: FileReference

  readonly artifacts: readonly RegistryArtifact[]
}

/**
 * An extension listing with current display metadata and available releases.
 *
 * The publisher derives display metadata from the highest stable manifest when one exists.
 */
export interface RegistryExtension extends ExtensionMetadata {
  readonly id: string
  readonly icon?: FileReference

  readonly releases: readonly RegistryRelease[]
}

/**
 * Known fields of an unsigned registry document.
 *
 * Original JSON may contain additional signed data that this typed projection omits.
 */
export interface RegistryDocument {
  readonly schemaVersion: typeof registrySchemaVersion
  readonly id: string
  /** Ed25519 SPKI PEM. Its presence does not grant trust to the registry. */
  readonly publicKey: string

  readonly defaultLocale: string
  readonly name: LocalizedText
  readonly description?: LocalizedText

  readonly extensions: readonly RegistryExtension[]
}

/** Parsed registry fields and root signature; authentication is a separate operation. */
export interface SignedRegistry extends RegistryDocument {
  readonly signature: string
}
