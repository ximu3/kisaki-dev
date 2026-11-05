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

/** Parse a complete composed candidate; personal data, local references and write instructions have no accepted fields. */
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

/** Composed fields are adoptable values; identification retains only original, unprocessed matching evidence. */
export interface CandidateEntry<T extends EntryType> extends MetadataObjectIdentity {
  readonly identification: IdentificationFields<T>
  readonly fields: MetadataEntryFields<T>
}

export interface CandidatePart<T extends PartType> extends MetadataObjectIdentity {
  readonly identification: PartIdentificationFields<T>
  readonly fields: MetadataPartFields<T>
}

export type CandidateRelatedEntries = { readonly [K in EntryType]?: readonly CandidateEntry<K>[] }

export type CandidateParts<T extends EntryType> = {
  readonly [K in MetadataPartKey<T>]?: readonly CandidatePart<MetadataPartType<T, K>>[]
}

/** One root and one request-local key space; local IDs, write flags and personal data are never metadata candidates. */
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
