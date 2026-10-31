/** @fileoverview Exposes source identification, metadata candidates, and provider participation contracts. */

export { parseIdentificationClues, parseWorkClues } from './identification'
export { parseMetadataInput, parseMetadataUpdateInput } from './api'
export type { MetadataProfilePreset } from './profiles'
export type {
  IdentificationFields,
  IdentificationClues,
  WorkClues,
  PartIdentificationFields,
} from './identification'
export { parseMetadataEntryFields, parseMetadataPartFields } from './fields'
export type {
  MetadataEntryValuesByType,
  MetadataPartValuesByType,
  MetadataEntryFields,
  MetadataPartFields,
  MetadataEntryField,
  MetadataPartField,
  MetadataPartKinds,
  MetadataPartKey,
  MetadataField,
} from './fields'
export { parseMetadataRelationScopes, metadataRelationKeys } from './relations'
export type {
  MetadataRelationMembers,
  MetadataRelation,
  MetadataRelationAttributes,
  MetadataRelationKey,
  CandidateRelations,
  MetadataScopeConditions,
  MetadataRelationScopeValues,
  MetadataScopeKey,
  MetadataRelationScopes,
  MetadataSessionScopes,
} from './relations'
export { parsePartMatchingRules, matchingName } from './matching'
export type {
  MatchingRule,
  EntryMatchingRules,
  PartMatchingField,
  PartMatchingRules,
  MetadataMatching,
} from './matching'
export { parseMetadataCandidate } from './candidate'
export type {
  CandidateEntry,
  CandidatePart,
  CandidateTag,
  CandidateRelatedEntries,
  CandidateParts,
  MetadataCandidate,
} from './candidate'
export {
  parseMetadataReadRequest,
  parseMetadataReadResult,
  validateProviderMethods,
} from './providers'
export type {
  SourceEntry,
  MetadataSearchInput,
  MetadataSearchResult,
  MetadataResolveInput,
  ResolveResult,
  MetadataOpenInput,
  MetadataPartRequests,
  MetadataReadRequest,
  MetadataEntryAnswer,
  MetadataPartAnswer,
  MetadataPartAnswers,
  MetadataReadResult,
  MetadataReadSession,
  MetadataImageField,
  MetadataImageSearchInput,
  MetadataImageSearchResult,
  MetadataReadCapabilities,
  MetadataProviderCapabilities,
  MetadataProviderDescription,
  MetadataProvider,
  MetadataProvidersApi,
} from './providers'
export { parseMetadataProfileDefinition } from './profiles'
export type {
  MetadataFieldRule,
  MetadataEntryFieldRules,
  MetadataPartFieldRules,
  MetadataProfileDefinition,
  MetadataProfile,
  MetadataProfileSummary,
  MetadataProfileChanges,
  MetadataProfileCreate,
  MetadataProfileUpdate,
  MetadataProfilesApi,
} from './profiles'
export { parseFieldProcessorResult } from './processors'
export type {
  FieldProcessorValue,
  FieldProcessorContext,
  FieldProcessorItem,
  FieldProcessorInput,
  FieldProcessorDescription,
  FieldProcessor,
  FieldProcessorsApi,
} from './processors'
export type {
  MetadataFetchResult,
  MetadataFetchInput,
  MetadataInput,
  MetadataUpdateInput,
  MetadataApi,
} from './api'
