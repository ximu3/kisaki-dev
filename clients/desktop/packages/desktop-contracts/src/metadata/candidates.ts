/** @fileoverview Defines composed metadata candidates and validates complete graph inputs. */

import { parseValue } from '../validation'
import * as v from 'valibot'
import { entryTypes } from '../library/catalog'
import { metadataPartKinds, objectsSchema } from './objects'
import { relationSchemas, validateGraph } from './graph'
import { parsePartMatchingRules } from './matching'
import type { EntryType, PartType } from '../library/catalog'
import type {
  MetadataObjectIdentity,
  MetadataPartKey,
  MetadataPartType,
  CandidateTag,
} from './objects'
import type {
  IdentificationFields,
  MetadataEntryFields,
  PartIdentificationFields,
  MetadataPartFields,
} from './fields'
import type { MetadataRelations } from './relations'
import type { PartMatchingRules } from './matching'

/**
 * Parses a composed candidate and validates its graph references and relationship constraints.
 *
 * The accepted shape contains metadata facts; personal data, local references and write
 * instructions are rejected.
 */
export function parseMetadataCandidate(input: unknown): MetadataCandidate {
  const { entryType } = parseValue(
    v.looseObject({ entryType: v.picklist(entryTypes) }),
    input,
    'Invalid metadata candidate',
  )
  const hasParts = Object.keys(metadataPartKinds[entryType]).length > 0
  const value = parseValue(
    v.strictObject({
      entryType: v.literal(entryType),
      objects: objectsSchema(entryType, true),
      relations: v.exactOptional(relationSchemas(entryType)),
      partMatching: v.exactOptional(
        hasParts
          ? v.pipe(
              v.unknown(),
              v.transform((value) => parsePartMatchingRules(entryType, value)),
            )
          : v.never(),
      ),
    }),
    input,
    'Invalid composed metadata candidate',
  )
  validateGraph(entryType, value.objects, value.relations)

  return value as MetadataCandidate
}

/**
 * Composed entry with adoptable fields and original matching evidence.
 *
 * Identification retains source facts before field processing.
 */
export interface CandidateEntry<T extends EntryType> extends MetadataObjectIdentity {
  readonly identification: IdentificationFields<T>
  readonly fields: MetadataEntryFields<T>
}

/** Composed part with adoptable fields and original matching evidence. */
export interface CandidatePart<T extends PartType> extends MetadataObjectIdentity {
  readonly identification: PartIdentificationFields<T>
  readonly fields: MetadataPartFields<T>
}

/** Related candidate entries grouped by their actual catalog kind. */
export type CandidateRelatedEntries = { readonly [K in EntryType]?: readonly CandidateEntry<K>[] }

/** Candidate parts grouped by slots supported by the root entry kind. */
export type CandidateParts<T extends EntryType> = {
  readonly [K in MetadataPartKey<T>]?: readonly CandidatePart<MetadataPartType<T, K>>[]
}

/**
 * Composed metadata graph with one root and a request-local object key space.
 *
 * The graph carries source facts and matching rules; local identity and adoption decisions belong
 * to ingest.
 */
export type MetadataCandidate<T extends EntryType = EntryType> = {
  [K in T]: {
    readonly entryType: K
    readonly objects: {
      readonly entry: CandidateEntry<K>
      readonly relatedEntries?: CandidateRelatedEntries
      readonly tags?: readonly CandidateTag[]
    } & (K extends 'anime' | 'comic' | 'novel' ? { readonly parts?: CandidateParts<K> } : object)
    readonly relations?: MetadataRelations<K>
  } & (K extends 'anime' | 'comic' | 'novel'
    ? { readonly partMatching?: PartMatchingRules<K> }
    : object)
}[T]
