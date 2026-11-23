import { fromParser, parseValue } from '../validation'
import * as v from 'valibot'
import { entryTypes, type EntryType, type PartType } from '../library/catalog'
import {
  metadataPartKinds,
  objectsSchema,
  type MetadataObjectIdentity,
  type MetadataPartKey,
  type MetadataPartType,
  type CandidateTag,
} from './objects'
import { relationSchemas, validateGraph } from './graph'
import { parsePartMatchingRules, type PartMatchingRules } from './matching'
import type {
  IdentificationFields,
  MetadataEntryFields,
  PartIdentificationFields,
  MetadataPartFields,
} from './fields'
import type { MetadataRelations } from './relations'

/**
 * Accepts metadata facts and validates graph references and constraints. Personal data, local
 * references and write instructions are invalid.
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
        hasParts ? fromParser((value) => parsePartMatchingRules(entryType, value)) : v.never(),
      ),
    }),
    input,
    'Invalid composed metadata candidate',
  )
  validateGraph(entryType, value.objects, value.relations)

  return value as MetadataCandidate
}

/** Identification retains original source evidence before field processing. */
export interface CandidateEntry<T extends EntryType> extends MetadataObjectIdentity {
  readonly identification: IdentificationFields<T>
  readonly fields: MetadataEntryFields<T>
}

/** Composed part with adoptable fields and original matching evidence. */
export interface CandidatePart<T extends PartType> extends MetadataObjectIdentity {
  readonly identification: PartIdentificationFields<T>
  readonly fields: MetadataPartFields<T>
}

export type CandidateRelatedEntries = { readonly [K in EntryType]?: readonly CandidateEntry<K>[] }

export type CandidateParts<T extends EntryType> = {
  readonly [K in MetadataPartKey<T>]?: readonly CandidatePart<MetadataPartType<T, K>>[]
}

/** Object keys are local to the graph. Ingest decides local identity and adoption. */
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
