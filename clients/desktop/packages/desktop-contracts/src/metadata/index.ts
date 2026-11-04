/** @fileoverview Publishes the metadata capability contract. */

export { parseMetadataFetchInput, parseMetadataFetchResult } from './fetch'

export { parseMetadataSearchRequest, parseMetadataImageSearchRequest } from './search'

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
} from './fields'

export {
  parseImageCandidate,
  parseMetadataEntryFields,
  parseMetadataPartFields,
  parseIdentificationFields,
  parsePartIdentificationFields,
  parseIdentificationClues,
  parseSourceEntry,
  getMetadataEntryFields,
  getMetadataPartFields,
  parseMetadataFieldRef,
  parseMetadataFieldValue,
  parseMetadataImplementationIds,
} from './fields'

export type {
  MetadataPartKinds,
  MetadataPartKey,
  MetadataPartType,
  MetadataObjectIdentity,
  CandidateTag,
} from './objects'

export type {
  EntryMatchingField,
  PartMatchingField,
  MatchingRule,
  PartMatchingRules,
  MetadataMatchingRules,
} from './matching'

export type {
  MetadataRelatedEntryRequests,
  MetadataPartRequests,
  MetadataReadRequest,
} from './requests'

export type {
  MetadataReadEntry,
  MetadataReadPart,
  MetadataReadRelatedEntries,
  MetadataReadParts,
  MetadataReadResult,
} from './responses'

export type {
  CandidateEntry,
  CandidatePart,
  CandidateRelatedEntries,
  CandidateParts,
  MetadataCandidate,
} from './candidates'

export { metadataPartKinds } from './objects'
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
} from './relations'

export {
  getMetadataRelations,
  parseMetadataRelationScope,
  parseMetadataRelationScopes,
  parseMetadataSessionRelationScopes,
  metadataRelationFields,
} from './relations'

export {
  getPartMatchingFields,
  parsePartMatchingRules,
  parseMetadataMatchingRules,
} from './matching'

export { parseMetadataReadRequest, requireMetadataRequestSupport } from './requests'

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
} from './providers'

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
} from './providers'

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
} from './processors'

export {
  parseFieldProcessingInput,
  parseFieldProcessingResult,
  parseProcessorFields,
} from './processors'

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
} from './profiles'

export {
  parseMetadataProfileDefinition,
  parseMetadataProfileCreate,
  parseMetadataProfileUpdate,
} from './profiles'

export { parseMetadataCandidate } from './candidates'
export { parseMetadataReadResult } from './responses'
export { metadataRelationTypeFromRoot } from './graph'
export type { MetadataFetchInput, MetadataFetchResult } from './fetch'

export type { MetadataSearchRequest, MetadataImageSearchRequest } from './search'

export type { MetadataApi } from './api'
