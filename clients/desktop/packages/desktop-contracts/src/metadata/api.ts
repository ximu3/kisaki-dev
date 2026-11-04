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

  search<T extends EntryType>(
    input: MetadataSearchRequest<T>,
    call?: CallOptions,
  ): Promise<MetadataSearchResult<T>>
  searchImages<T extends EntryType>(
    input: MetadataImageSearchRequest<T>,
    call?: CallOptions,
  ): Promise<MetadataImageSearchResult>

  fetch<T extends EntryType>(
    input: MetadataFetchInput<T>,
    call?: CallOptions,
  ): Promise<MetadataFetchResult<T>>
}
