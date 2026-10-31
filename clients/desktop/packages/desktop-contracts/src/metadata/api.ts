/** @fileoverview Exposes complete source acquisition without granting local adoption or write authority. */

import * as v from 'valibot'
import type { CallOptions } from '../execution'
import { objectSchema } from '../schema'
import { nonemptyStringSchema, parseContract } from '../validation'
import type { IngestIssue } from '../ingest/issues'
import type { EntryType } from '../library/identity'
import { parseMetadataCandidate, type MetadataCandidate } from './candidate'
import { parseIdentificationClues, type IdentificationClues } from './identification'
import type { FieldProcessorsApi } from './processors'
import type { MetadataProfilesApi } from './profiles'
import type {
  MetadataImageSearchInput,
  MetadataImageSearchResult,
  MetadataProvidersApi,
  MetadataReadRequest,
  MetadataSearchInput,
  MetadataSearchResult,
} from './providers'
import { parseMetadataRelationScopes, type MetadataRelationScopes } from './relations'

/** One usable candidate graph and the safe complete-range evidence established by this acquisition. */
export interface MetadataFetchResult<Type extends EntryType = EntryType> {
  readonly data: MetadataCandidate<Type>
  readonly relationScopes: MetadataRelationScopes<Type>
  readonly issues: readonly IngestIssue[]
}
export interface MetadataFetchInput<Type extends EntryType> {
  readonly entryType: Type
  readonly profileId: string
  readonly clues: IdentificationClues<Type>
  readonly request?: MetadataReadRequest<Type>
}
export type MetadataInput<Type extends EntryType> =
  | {
      readonly type: 'profile'
      readonly profileId: string
      readonly clues: IdentificationClues<Type>
    }
  | {
      readonly type: 'prepared'
      readonly data: MetadataCandidate<Type>
      readonly relationScopes?: MetadataRelationScopes<Type>
    }
export type MetadataUpdateInput<Type extends EntryType> =
  | {
      readonly type: 'profile'
      readonly profileId: string
      readonly clues?: IdentificationClues<Type>
    }
  | {
      readonly type: 'prepared'
      readonly data: MetadataCandidate<Type>
      readonly relationScopes?: MetadataRelationScopes<Type>
    }
export interface MetadataApi {
  readonly providers: MetadataProvidersApi
  readonly fieldProcessors: FieldProcessorsApi
  readonly profiles: MetadataProfilesApi
  /** Search exactly one provider; existing rows and source identities are never changed by browsing. */
  search<Type extends EntryType>(
    input: MetadataSearchInput<Type> & { readonly providerId: string },
    call?: CallOptions,
  ): Promise<MetadataSearchResult<Type>>
  /** Browse a provider's explicitly supported image capability, without creating attachments. */
  searchImages<Type extends EntryType>(
    input: MetadataImageSearchInput<Type> & { readonly providerId: string },
    call?: CallOptions,
  ): Promise<MetadataImageSearchResult>
  /** Fix the profile and implementation snapshots, acquire and compose source facts, then close all read sessions. */
  fetch<Type extends EntryType>(
    input: MetadataFetchInput<Type>,
    call?: CallOptions,
  ): Promise<MetadataFetchResult<Type>>
}

/** Validate acquisition responsibility and prepared candidate ownership for a new root. */
export function parseMetadataInput<Type extends EntryType>(
  type: Type,
  input: unknown,
): MetadataInput<Type> {
  const clues = v.pipe(
    v.unknown(),
    v.transform((value) => parseIdentificationClues(type, value)),
  )
  return parseContract(
    v.union([
      objectSchema({ type: v.literal('profile'), profileId: nonemptyStringSchema, clues }),
      preparedInputSchema(type),
    ]),
    input,
    'metadata input',
  )
}
/** Validate a fixed-target acquisition; absent profile clues are resolved from that target by the owner. */
export function parseMetadataUpdateInput<Type extends EntryType>(
  type: Type,
  input: unknown,
): MetadataUpdateInput<Type> {
  const clues = v.pipe(
    v.unknown(),
    v.transform((value) => parseIdentificationClues(type, value)),
  )
  return parseContract(
    v.union([
      objectSchema({
        type: v.literal('profile'),
        profileId: nonemptyStringSchema,
        clues: v.exactOptional(clues),
      }),
      preparedInputSchema(type),
    ]),
    input,
    'metadata update input',
  )
}
function preparedInputSchema<Type extends EntryType>(type: Type) {
  const data = v.pipe(
    v.unknown(),
    v.transform((value) => parseMetadataCandidate(type, value)),
  )
  return objectSchema({
    type: v.literal('prepared'),
    data,
    relationScopes: v.exactOptional(
      v.pipe(
        v.unknown(),
        v.transform((value) => parseMetadataRelationScopes(type, value)),
      ),
    ),
  })
}
