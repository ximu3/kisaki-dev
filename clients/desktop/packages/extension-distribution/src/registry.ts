/** @fileoverview Defines flat extension registries, immutable artifacts, and response-relative references. */

import * as v from 'valibot'
import { looseObjectSchema } from './schema'
import { compare } from 'semver'
import { extensionIdSchema } from './identity'
import {
  displayEntries,
  normalizeDisplay,
  requirementEntries,
  type ExtensionAuthor,
  type ExtensionRequirements,
} from './manifest'
import {
  localizedTextSchema,
  parseLanguageTag,
  parseLocalizedText,
  type LocalizedText,
} from './metadata'
import {
  DistributionError,
  parseFormat,
  parseHttpUrl,
  sha256Schema,
  sizeSchema,
  textSchema,
  versionSchema,
} from './validation'

/** Version of the flat signed registry document. */
export const registrySchemaVersion = 1

/** Exact immutable bytes, resolved against the registry's final response URL after verification. */
export interface DistributionFile {
  readonly url: string
  readonly size: number
  readonly sha256: string
}

/** One version's platform artifact with its own conditions and license. */
export interface ExtensionArtifact extends DistributionFile, ExtensionRequirements {
  readonly license?: string
}

/** One immutable SemVer release; prose may be corrected by publishing a newly signed index. */
export interface ExtensionRelease {
  readonly version: string
  readonly publishedAt: number
  readonly defaultLocale: string
  readonly releaseNotes?: LocalizedText
  readonly readme?: DistributionFile
  readonly artifacts: readonly ExtensionArtifact[]
}

/** Current catalog display metadata; it does not replace any installed package's manifest. */
export interface RegistryExtension {
  readonly id: string
  readonly defaultLocale: string
  readonly name: LocalizedText
  readonly description?: LocalizedText
  readonly categories?: readonly string[]
  readonly keywords?: readonly string[]
  readonly author?: ExtensionAuthor
  readonly homepage?: string
  readonly repository?: string
  readonly issues?: string
  readonly icon?: DistributionFile
  readonly releases: readonly ExtensionRelease[]
}

/** Parsed catalog. Trust is established separately using the original received JSON and a pinned key. */
export interface ExtensionRegistry {
  readonly schemaVersion: 1
  readonly id: string
  readonly publicKey: string
  readonly defaultLocale: string
  readonly name: LocalizedText
  readonly description?: LocalizedText
  readonly extensions: readonly RegistryExtension[]
  readonly signature: string
}

const referenceSchema = v.pipe(
  textSchema,
  v.check((value) => {
    try {
      parseHttpUrl(value, 'https://registry.invalid/')
      return true
    } catch {
      return false
    }
  }),
)
const fileEntries = { url: referenceSchema, size: sizeSchema, sha256: sha256Schema }
const fileSchema = looseObjectSchema(fileEntries)
const releaseSchema = looseObjectSchema({
  version: versionSchema,
  publishedAt: v.pipe(v.number(), v.safeInteger()),
  defaultLocale: textSchema,
  releaseNotes: v.exactOptional(localizedTextSchema),
  readme: v.exactOptional(fileSchema),
  artifacts: v.pipe(
    v.array(
      looseObjectSchema({
        ...fileEntries,
        ...requirementEntries,
        license: v.exactOptional(textSchema),
      }),
    ),
    v.minLength(1),
  ),
})
const registrySchema = looseObjectSchema({
  schemaVersion: v.literal(registrySchemaVersion),
  id: extensionIdSchema,
  publicKey: textSchema,
  defaultLocale: textSchema,
  name: localizedTextSchema,
  description: v.exactOptional(localizedTextSchema),
  extensions: v.array(
    looseObjectSchema({
      id: extensionIdSchema,
      ...displayEntries,
      icon: v.exactOptional(fileSchema),
      releases: v.pipe(v.array(releaseSchema), v.minLength(1)),
    }),
  ),
  signature: textSchema,
})

/** Parse a registry after verification, preserving unknown signed fields and rejecting ambiguous releases. */
export function parseExtensionRegistry(input: unknown): ExtensionRegistry {
  const document = parseFormat(registrySchema, input, 'extension registry')
  const ids = new Set<string>()
  const extensions = document.extensions.map((extension) => {
    if (ids.has(extension.id)) {
      throw new DistributionError('InvalidFormat', 'The registry repeats an extension identity.')
    }
    ids.add(extension.id)
    const versions: string[] = []
    const releases = extension.releases.map((release) => {
      if (versions.some((version) => compare(version, release.version) === 0)) {
        throw new DistributionError(
          'InvalidFormat',
          'The registry repeats a SemVer release precedence.',
        )
      }
      versions.push(release.version)
      const targets = new Set<string>()
      for (const artifact of release.artifacts) {
        for (const target of artifact.targets) {
          if (targets.has(target)) {
            throw new DistributionError('InvalidFormat', 'Release artifacts overlap on a target.')
          }
          targets.add(target)
        }
      }
      const defaultLocale = parseLanguageTag(release.defaultLocale)
      return {
        ...release,
        defaultLocale,
        ...(release.releaseNotes === undefined
          ? {}
          : { releaseNotes: parseLocalizedText(release.releaseNotes, defaultLocale) }),
      }
    })
    return { ...normalizeDisplay(extension), releases }
  })
  return { ...normalizeDisplay(document), extensions }
}

/** Resolve a verified reference without changing the signed document or its saved entry URL. */
export function resolveDistributionFile(
  file: DistributionFile,
  responseUrl: string,
): DistributionFile {
  return { ...file, url: parseHttpUrl(file.url, parseHttpUrl(responseUrl)) }
}
