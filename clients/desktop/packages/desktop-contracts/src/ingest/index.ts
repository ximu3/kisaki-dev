/** @fileoverview Publishes the ingest capability contract. */

export { parseMetadataInput, parseMetadataUpdateInput } from './metadata'

export { parseIngestAddInput, parseAddResult } from './add'
export {
  parseIngestUpdateItem,
  hasIngestUpdateWork,
  parseUpdateResult,
  parseIngestUpdateTarget,
} from './update'

export { parseIngestBatchResult } from './api'

export type { IngestIssue, IngestRelationRef } from './issues'

export { parseIngestIssue, parseIngestRelationRef } from './issues'

export type { IngestApi, IngestExecutor, IngestBatchResult } from './api'

export type { MetadataInput, MetadataUpdateInput } from './metadata'

export type { IngestLocalContent, IngestAddInput, AddResult } from './add'

export type {
  PersonAdoptionScope,
  IngestRelationScope,
  FieldAdoption,
  IngestRelationUpdate,
  IngestEntryUpdate,
  IngestPartUpdate,
  IngestUpdateType,
  IngestUpdateRef,
  IngestUpdateInput,
  IngestUpdateItem,
  UpdateResult,
} from './update'
