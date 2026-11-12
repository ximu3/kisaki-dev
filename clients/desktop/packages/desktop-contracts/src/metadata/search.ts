/** @fileoverview Defines source search requests and their allowed root and image contexts. */

import type { EntryType } from '../library/catalog'
import type { MetadataSearchInput, MetadataImageSearchInput } from './providers'
import { parseRecord, parseValue, id } from '../validation'
import { parseMetadataSearchInput, parseMetadataImageSearchInput } from './providers'

export type MetadataSearchRequest<T extends EntryType = EntryType> = MetadataSearchInput<T> & {
  readonly providerId: string
}

export type MetadataImageSearchRequest<T extends EntryType = EntryType> =
  MetadataImageSearchInput<T> & { readonly providerId: string }

/** A provider ID selects the implementation, not an ExternalIdentity.source or a candidate's rank. */
export function parseMetadataSearchRequest(input: unknown): MetadataSearchRequest {
  const { providerId, ...fields } = parseRecord(input)
  return { providerId: parseValue(id, providerId), ...parseMetadataSearchInput(fields) }
}

/** Image lookup uses the same explicit provider and source-defined query contract as the provider callback. */
export function parseMetadataImageSearchRequest(input: unknown): MetadataImageSearchRequest {
  const { providerId, ...fields } = parseRecord(input)
  return { providerId: parseValue(id, providerId), ...parseMetadataImageSearchInput(fields) }
}
