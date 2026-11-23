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

/** Search and fetch return source facts before adoption into the local catalog. */
export interface MetadataApi {
  readonly providers: MetadataProvidersApi
  readonly fieldProcessors: MetadataFieldProcessorsApi
  readonly profiles: MetadataProfilesApi

  search<T extends EntryType>(
    input: MetadataSearchRequest<T>,
    call?: CallOptions,
  ): Promise<MetadataSearchResult<T>>

  /** Returns source image candidates. Download and adoption occur through separate operations. */
  searchImages<T extends EntryType>(
    input: MetadataImageSearchRequest<T>,
    call?: CallOptions,
  ): Promise<MetadataImageSearchResult>

  /**
   * Captures the selected profile and releases its source sessions before returning the validated
   * candidate.
   */
  fetch<T extends EntryType>(
    input: MetadataFetchInput<T>,
    call?: CallOptions,
  ): Promise<MetadataFetchResult<T>>
}
