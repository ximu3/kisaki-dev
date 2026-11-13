/** @fileoverview Defines profile-fetch inputs and complete candidate outcomes. */

import type { EntryType } from '../library/catalog'
import type { IdentificationClues } from './fields'
import type { MetadataReadRequest } from './requests'
import type { MetadataCandidate } from './candidates'
import type { MetadataRelationScopes } from './relations'
import type { IngestIssue } from '../ingest/issues'
import { parseValue, id } from '../validation'
import * as v from 'valibot'
import { entryTypes } from '../library/catalog'
import { parseIdentificationClues } from './fields'
import { parseMetadataReadRequest } from './requests'
import { parseMetadataCandidate } from './candidates'
import { parseIngestIssue } from '../ingest/issues'
import { parseMetadataRelationScopes } from './relations'

/**
 * Profile-based fetch request for one entry, with identification clues and an optional read scope.
 */
export type MetadataFetchInput<T extends EntryType = EntryType> = {
  [K in EntryType]: {
    readonly entryType: K
    readonly profileId: string
    readonly clues: IdentificationClues<K>
    readonly request?: MetadataReadRequest<K>
  }
}[T]

/**
 * Validated candidate, relation-scope evidence and issues produced by a metadata fetch.
 *
 * Ingest determines creation sufficiency and how the candidate relates to existing local objects.
 */
export type MetadataFetchResult<T extends EntryType = EntryType> = {
  [K in T]: {
    readonly data: MetadataCandidate<K>
    readonly relationScopes: MetadataRelationScopes<K>
    readonly issues: readonly IngestIssue[]
  }
}[T]

/**
 * Parses a fetch request for its declared entry kind.
 *
 * Execution checks a supplied read scope against the selected profile and rejects unsupported
 * requests rather than narrowing them.
 */
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

/** Parses a candidate, root-compatible relation scopes and issues as one fetch result. */
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
  } as MetadataFetchResult
}
