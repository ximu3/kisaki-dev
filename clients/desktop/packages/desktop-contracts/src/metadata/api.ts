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

/** Search one named provider, or fetch through one fixed profile; neither operation writes local catalog data. */
export interface MetadataApi {
  readonly providers: MetadataProvidersApi
  readonly fieldProcessors: MetadataFieldProcessorsApi
  readonly profiles: MetadataProfilesApi

  /**
   * Search the explicitly selected provider and preserve its result identities, matching
   * evidence and pagination; do not adopt local records.
   */
  search<T extends EntryType>(
    input: MetadataSearchRequest<T>,
    call?: CallOptions,
  ): Promise<MetadataSearchResult<T>>

  /**
   * Search the named provider for the requested image use, preserving source candidates without
   * downloading or adopting them.
   */
  searchImages<T extends EntryType>(
    input: MetadataImageSearchRequest<T>,
    call?: CallOptions,
  ): Promise<MetadataImageSearchResult>

  /**
   * Fix the selected profile, obtain and compose source facts into a validated candidate, and
   * release source sessions before completion.
   */
  fetch<T extends EntryType>(
    input: MetadataFetchInput<T>,
    call?: CallOptions,
  ): Promise<MetadataFetchResult<T>>
}
