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
