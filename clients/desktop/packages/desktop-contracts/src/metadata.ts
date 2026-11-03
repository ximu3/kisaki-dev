/** @fileoverview Exposes complete source search, profile fetch and participant registration using one shared metadata model. */

import * as v from 'valibot'
import { id, parseValue, readRecord } from './validation'
import type { CallOptions } from './operations'
import { entryTypes } from './library/catalog'
import type { EntryType } from './library/catalog'
import { parseIdentificationClues } from './metadata/fields'
import type { IdentificationClues } from './metadata/fields'
import { parseMetadataCandidate } from './metadata/graph'
import type { MetadataCandidate, MetadataReadRequest } from './metadata/values'
import { parseMetadataReadRequest } from './metadata/requests'
import { parseMetadataRelationScopes } from './metadata/relations'
import type { MetadataRelationScopes } from './metadata/relations'
import type { MetadataFieldProcessorsApi } from './metadata/processors'
import type { MetadataProfilesApi } from './metadata/profiles'
import { parseMetadataImageSearchInput, parseMetadataSearchInput } from './metadata/providers'
import type {
  MetadataImageSearchInput,
  MetadataImageSearchResult,
  MetadataProvidersApi,
  MetadataSearchInput,
  MetadataSearchResult,
} from './metadata/providers'
import { parseIngestIssue } from './ingest/issues'
import type { IngestIssue } from './ingest/issues'

export type {
  ImageIdentity,
  ImageCandidate,
  MetadataEntryFieldValues,
  MetadataEntryFields,
  MetadataEntryField,
  MetadataPartFieldValues,
  MetadataPartFields,
  MetadataPartField,
  MetadataTagFields,
  MetadataImageField,
  MetadataFieldRef,
  MetadataImageFieldRef,
  MetadataFieldValue,
  IdentificationFields,
  PartIdentificationFields,
  WorkClues,
  IdentificationClues,
  SourceEntry,
} from './metadata/fields'
export {
  parseImageCandidate,
  parseMetadataEntryFields,
  parseMetadataPartFields,
  parseIdentificationFields,
  parsePartIdentificationFields,
  parseIdentificationClues,
  parseSourceEntry,
  metadataNameKey,
  mergeIdentificationClues,
  hasNewWorkClues,
  selectMetadataValue,
  unionMetadataMembers,
  isEmptyMetadataValue,
  isMetadataCollectionField,
  selectMetadataFieldValue,
  getMetadataEntryFields,
  getMetadataPartFields,
  parseMetadataFieldRef,
  parseMetadataFieldValue,
  parseMetadataImplementationIds,
} from './metadata/fields'

export type {
  MetadataPartKinds,
  MetadataPartKey,
  MetadataPartType,
  EntryMatchingField,
  PartMatchingField,
  MatchingRule,
  PartMatchingRules,
  MetadataMatchingRules,
  MetadataRelatedEntryRequests,
  MetadataPartRequests,
  MetadataReadRequest,
  MetadataObjectIdentity,
  MetadataReadEntry,
  MetadataReadPart,
  CandidateTag,
  MetadataReadRelatedEntries,
  MetadataReadParts,
  MetadataReadResult,
  CandidateEntry,
  CandidatePart,
  CandidateRelatedEntries,
  CandidateParts,
  MetadataCandidate,
} from './metadata/values'
export { metadataPartKinds } from './metadata/values'

export type {
  MetadataRelationMembers,
  MetadataRelationAttributeValues,
  MetadataRelationKey,
  MetadataRelations,
  CandidateRelations,
  WorkCharacterMetadataScope,
  PersonWorkScopeCondition,
  PersonWorkMetadataScope,
  OrganizationWorkMetadataScope,
  WorkRelationMetadataScope,
  MetadataRelationScopeValues,
  ScopedMetadataRelationKey,
  MetadataRelationScopes,
  MetadataSessionRelationScopes,
  MetadataScopeAnswer,
} from './metadata/relations'
export {
  getMetadataRelations,
  parseMetadataRelationScope,
  parseMetadataRelationScopes,
  parseMetadataSessionRelationScopes,
  combineMetadataRelationScope,
  metadataRelationFields,
} from './metadata/relations'

export type { MatchingComparison } from './metadata/matching'
export {
  getPartMatchingFields,
  parsePartMatchingRules,
  parseMetadataMatchingRules,
  compareEntryIdentification,
  comparePartIdentification,
} from './metadata/matching'

export { parseMetadataReadRequest, requireMetadataRequestSupport } from './metadata/requests'

export type {
  MetadataSearchInput,
  MetadataSearchResult,
  MetadataResolveInput,
  ResolveResult,
  MetadataOpenSessionInput,
  MetadataImageSearchInput,
  MetadataImageSearchResult,
  MetadataObjectCapability,
  MetadataReadCapabilities,
  MetadataProviderCapabilities,
  MetadataReadSession,
  MetadataProvider,
  MetadataProviderDescriptor,
  MetadataProvidersApi,
} from './metadata/providers'
export {
  parseMetadataProviderCapabilities,
  validateMetadataProvider,
  parseMetadataSearchInput,
  parseMetadataResolveInput,
  parseMetadataOpenSessionInput,
  parseMetadataImageSearchInput,
  parseMetadataSearchResult,
  parseResolveResult,
  parseMetadataImageSearchResult,
} from './metadata/providers'

export type {
  ProcessingEntryContext,
  ProcessingPartContext,
  FieldProcessingContext,
  FieldProcessingItem,
  FieldProcessingInput,
  FieldProcessingResult,
  MetadataFieldProcessor,
  MetadataFieldProcessorDescriptor,
  MetadataFieldProcessorsApi,
} from './metadata/processors'
export {
  parseFieldProcessingInput,
  parseFieldProcessingResult,
  parseProcessorFields,
} from './metadata/processors'

export type {
  MetadataFieldRule,
  MetadataEntryFieldRules,
  MetadataPartFieldRules,
  MetadataRelationRule,
  MetadataProfileDefinition,
  MetadataProfileSnapshot,
  MetadataProfile,
  MetadataProfileCreate,
  MetadataProfileEditableFields,
  MetadataProfileUpdate,
  MetadataProfilePreset,
  MetadataProfilesApi,
} from './metadata/profiles'
export {
  parseMetadataProfileDefinition,
  parseMetadataProfileCreate,
  parseMetadataProfileUpdate,
} from './metadata/profiles'

export {
  parseMetadataCandidate,
  parseMetadataReadResult,
  metadataRelationTypeFromRoot,
} from './metadata/graph'

/** A fetch fixes a real profile and request scope, without local lookup or adoption policy. */
export type MetadataFetchInput<T extends EntryType = EntryType> = {
  [K in EntryType]: {
    readonly entryType: K
    readonly profileId: string
    readonly clues: IdentificationClues<K>
    readonly request?: MetadataReadRequest<K>
  }
}[T]

/** Successful data has one legal root; creation sufficiency and existing local-object decisions belong to ingest. */
export interface MetadataFetchResult<T extends EntryType = EntryType> {
  readonly data: MetadataCandidate<T>
  readonly relationScopes: MetadataRelationScopes<T>
  readonly issues: readonly IngestIssue[]
}

export type MetadataSearchRequest<T extends EntryType = EntryType> = MetadataSearchInput<T> & {
  readonly providerId: string
}

export type MetadataImageSearchRequest<T extends EntryType = EntryType> =
  MetadataImageSearchInput<T> & { readonly providerId: string }

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

/** Validate the complete request; a supplied read scope must later be checked against the selected profile, never intersected away. */
export function parseMetadataFetchInput(input: unknown): MetadataFetchInput {
  const { entryType } = parseValue(v.looseObject({ entryType: v.picklist(entryTypes) }), input)
  return parseValue(
    v.strictObject({
      entryType: v.literal(entryType),
      profileId: id,
      clues: v.pipe(
        v.unknown(),
        v.transform((value) => parseIdentificationClues(entryType, value)),
      ),
      request: v.exactOptional(
        v.pipe(
          v.unknown(),
          v.transform((value) => parseMetadataReadRequest(entryType, value)),
        ),
      ),
    }),
    input,
    'Invalid metadata fetch',
  ) as MetadataFetchInput
}

/** Validate candidate, independent replacement evidence and local issues as one complete fetch result. */
export function parseMetadataFetchResult(input: unknown): MetadataFetchResult {
  const value = parseValue(
    v.strictObject({
      data: v.pipe(v.unknown(), v.transform(parseMetadataCandidate)),
      relationScopes: v.unknown(),
      issues: v.array(v.pipe(v.unknown(), v.transform(parseIngestIssue))),
    }),
    input,
    'Invalid metadata fetch result',
  )
  return {
    ...value,
    relationScopes: parseMetadataRelationScopes(value.data.entryType, value.relationScopes),
  }
}

/** A provider ID selects the implementation, not an ExternalIdentity.source or a candidate's rank. */
export function parseMetadataSearchRequest(input: unknown): MetadataSearchRequest {
  const { providerId, ...fields } = readRecord(input)
  return { providerId: parseValue(id, providerId), ...parseMetadataSearchInput(fields) }
}

/** Image lookup uses the same explicit provider and source-defined query contract as the provider callback. */
export function parseMetadataImageSearchRequest(input: unknown): MetadataImageSearchRequest {
  const { providerId, ...fields } = readRecord(input)
  return { providerId: parseValue(id, providerId), ...parseMetadataImageSearchInput(fields) }
}
