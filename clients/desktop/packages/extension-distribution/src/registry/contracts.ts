import type { CompatibilityDeclaration } from '../compatibility'
import type { ExtensionMetadata, LocalizedText } from '../metadata'

export const registrySchemaVersion = 1

export interface FileReference {
  readonly url: string
  readonly size: number
  readonly sha256: string
}

export interface RegistryArtifact extends FileReference, CompatibilityDeclaration {
  readonly license?: string
}

export interface RegistryRelease {
  readonly version: string
  readonly publishedAt: number

  readonly defaultLocale: string
  readonly releaseNotes?: LocalizedText
  readonly readme?: FileReference

  readonly artifacts: readonly RegistryArtifact[]
}

export interface RegistryExtension extends ExtensionMetadata {
  readonly id: string
  readonly icon?: FileReference

  readonly releases: readonly RegistryRelease[]
}

export interface RegistryDocument {
  readonly schemaVersion: typeof registrySchemaVersion
  readonly id: string
  readonly publicKey: string

  readonly defaultLocale: string
  readonly name: LocalizedText
  readonly description?: LocalizedText

  readonly extensions: readonly RegistryExtension[]
}

export interface SignedRegistry extends RegistryDocument {
  readonly signature: string
}
