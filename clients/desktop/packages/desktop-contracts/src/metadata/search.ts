import type { EntryType } from '../library/catalog'
import { parseRecord, parseValue, id } from '../validation'
import {
  parseMetadataSearchInput,
  parseMetadataImageSearchInput,
  type MetadataSearchInput,
  type MetadataImageSearchInput,
} from './providers'

export type MetadataSearchRequest<T extends EntryType = EntryType> = MetadataSearchInput<T> & {
  readonly providerId: string
}

export type MetadataImageSearchRequest<T extends EntryType = EntryType> =
  MetadataImageSearchInput<T> & { readonly providerId: string }

/** The provider implementation ID is separate from an external identity's source namespace. */
export function parseMetadataSearchRequest(input: unknown): MetadataSearchRequest {
  const { providerId, ...fields } = parseRecord(input)
  return { providerId: parseValue(id, providerId), ...parseMetadataSearchInput(fields) }
}

export function parseMetadataImageSearchRequest(input: unknown): MetadataImageSearchRequest {
  const { providerId, ...fields } = parseRecord(input)
  return { providerId: parseValue(id, providerId), ...parseMetadataImageSearchInput(fields) }
}
