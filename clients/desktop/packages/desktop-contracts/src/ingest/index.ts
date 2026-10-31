/** @fileoverview Exposes complete local adoption contracts and their safe issue vocabulary. */

export type { MetadataRelationAddress, MetadataImageAddress, IngestIssue } from './issues'
export type {
  AdoptionMode,
  IngestAddInput,
  AddResult,
  IngestUserScopeValues,
  IngestRelationAdoption,
  IngestRelations,
  IngestUpdateInput,
  UpdateResult,
  IngestBatchResult,
  IngestUpdateItem,
  IngestApi,
} from './api'
export { parseIngestAddInput, parseIngestRelations, parseIngestUpdateInput } from './api'
