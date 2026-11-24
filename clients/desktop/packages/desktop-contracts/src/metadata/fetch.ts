import { fromParser, parseValue, id } from '../validation'
import * as v from 'valibot'
import { entryTypes, type EntryType } from '../library/catalog'
import { parseIdentificationClues, type IdentificationClues } from './fields'
import { parseMetadataReadRequest, type MetadataReadRequest } from './requests'
import { parseMetadataCandidate, type MetadataCandidate } from './candidates'
import { parseIngestIssue, type IngestIssue } from '../ingest/issues'
import { parseMetadataRelationScopes, type MetadataRelationScopes } from './relations'

export type MetadataFetchInput<T extends EntryType = EntryType> = {
  [K in EntryType]: {
    readonly entryType: K
    readonly profileId: string
    readonly clues: IdentificationClues<K>
    readonly request?: MetadataReadRequest<K>
  }
}[T]

export type MetadataFetchResult<T extends EntryType = EntryType> = {
  [K in T]: {
    readonly data: MetadataCandidate<K>
    readonly relationScopes: MetadataRelationScopes<K>
    readonly issues: readonly IngestIssue[]
  }
}[T]

export function parseMetadataFetchInput(input: unknown): MetadataFetchInput {
  const { entryType } = parseValue(v.looseObject({ entryType: v.picklist(entryTypes) }), input)
  return parseValue(
    v.strictObject({
      entryType: v.literal(entryType),
      profileId: id,
      clues: fromParser((value) => parseIdentificationClues(entryType, value)),
      request: v.exactOptional(fromParser((value) => parseMetadataReadRequest(entryType, value))),
    }),
    input,
    'Invalid metadata fetch',
  ) as MetadataFetchInput
}

export function parseMetadataFetchResult(input: unknown): MetadataFetchResult {
  const value = parseValue(
    v.strictObject({
      data: fromParser(parseMetadataCandidate),
      relationScopes: v.unknown(),
      issues: v.array(fromParser(parseIngestIssue)),
    }),
    input,
    'Invalid metadata fetch result',
  )
  return {
    ...value,
    relationScopes: parseMetadataRelationScopes(value.data.entryType, value.relationScopes),
  } as MetadataFetchResult
}
