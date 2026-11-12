/** @fileoverview Publishes the ingest capability contract. */

export { parseMetadataInput, parseMetadataUpdateInput } from './metadata'

export { parseIngestAddInput, parseIngestAddResult } from './add'
export {
  parseIngestUpdateItem,
  hasIngestUpdateWork,
  parseIngestUpdateResult,
  parseIngestUpdateTarget,
} from './update'

export { parseIngestBatchResult } from './api'

export type { IngestIssue, IngestRelationRef } from './issues'

export { parseIngestIssue, parseIngestRelationRef } from './issues'

export type { IngestApi, IngestExecutor, IngestBatchResult } from './api'

export type { MetadataInput, MetadataUpdateInput } from './metadata'

export type { IngestLocalContent, IngestAddInput, IngestAddResult } from './add'

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
  IngestUpdateResult,
} from './update'
