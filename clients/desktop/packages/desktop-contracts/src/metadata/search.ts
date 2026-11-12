/** @fileoverview Defines source search requests and their allowed root and image contexts. */

import type { EntryType } from '../library/catalog'
import type { MetadataSearchInput, MetadataImageSearchInput } from './providers'
import { parseRecord, parseValue, id } from '../validation'
import { parseMetadataSearchInput, parseMetadataImageSearchInput } from './providers'

/** Source search input addressed to one explicitly selected provider implementation. */
export type MetadataSearchRequest<T extends EntryType = EntryType> = MetadataSearchInput<T> & {
  readonly providerId: string
}

/** Image lookup input addressed to one explicitly selected provider implementation. */
export type MetadataImageSearchRequest<T extends EntryType = EntryType> =
  MetadataImageSearchInput<T> & { readonly providerId: string }

/**
 * Parses a provider implementation ID and its source-search input.
 *
 * The provider ID is separate from an external identity's source namespace.
 */
export function parseMetadataSearchRequest(input: unknown): MetadataSearchRequest {
  const { providerId, ...fields } = parseRecord(input)
  return { providerId: parseValue(id, providerId), ...parseMetadataSearchInput(fields) }
}

/** Parses an explicit provider ID and the image lookup input passed to that provider. */
export function parseMetadataImageSearchRequest(input: unknown): MetadataImageSearchRequest {
  const { providerId, ...fields } = parseRecord(input)
  return { providerId: parseValue(id, providerId), ...parseMetadataImageSearchInput(fields) }
}
