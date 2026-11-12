/** @fileoverview Composes provider search, profile fetching and participant management. */

import type {
  MetadataProvidersApi,
  MetadataSearchResult,
  MetadataImageSearchResult,
} from './providers'
import type { MetadataFieldProcessorsApi } from './processors'
import type { MetadataProfilesApi } from './profiles'
import type { EntryType } from '../library/catalog'
import type { MetadataSearchRequest, MetadataImageSearchRequest } from './search'
import type { CallOptions } from '../operations'
import type { MetadataFetchInput, MetadataFetchResult } from './fetch'

/**
 * Provider search, profile-based metadata fetching and participant management.
 *
 * Search and fetch return source information without writing local catalog data.
 */
export interface MetadataApi {
  readonly providers: MetadataProvidersApi
  readonly fieldProcessors: MetadataFieldProcessorsApi
  readonly profiles: MetadataProfilesApi

  /**
   * Searches the selected provider and preserves result identities, matching evidence and
   * pagination.
   */
  search<T extends EntryType>(
    input: MetadataSearchRequest<T>,
    call?: CallOptions,
  ): Promise<MetadataSearchResult<T>>

  /**
   * Searches the selected provider for an image use and returns source candidates without
   * downloading them.
   */
  searchImages<T extends EntryType>(
    input: MetadataImageSearchRequest<T>,
    call?: CallOptions,
  ): Promise<MetadataImageSearchResult>

  /**
   * Captures the selected profile and composes source facts into a validated candidate.
   *
   * Source sessions are released before the operation completes.
   */
  fetch<T extends EntryType>(
    input: MetadataFetchInput<T>,
    call?: CallOptions,
  ): Promise<MetadataFetchResult<T>>
}
