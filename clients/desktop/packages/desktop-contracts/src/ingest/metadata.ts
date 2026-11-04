/** @fileoverview Defines allowed source or candidate inputs for metadata adoption. */

import type { EntryType } from '../library/catalog'
import type { IdentificationClues } from '../metadata/fields'
import type { MetadataCandidate } from '../metadata/candidates'
import type { MetadataRelationScopes } from '../metadata/relations'
import * as v from 'valibot'
import { parseIdentificationClues } from '../metadata/fields'
import { parseMetadataCandidate } from '../metadata/candidates'
import { parseValue, id } from '../validation'
import { parseMetadataRelationScopes } from '../metadata/relations'

/** Prepared candidates contain source facts and completeness evidence, never a local patch or writeGraph request. */
export type MetadataInput<T extends EntryType> =
  | { readonly type: 'profile'; readonly profileId: string; readonly clues: IdentificationClues<T> }
  | {
      readonly type: 'prepared'
      readonly data: MetadataCandidate<T>
      readonly relationScopes?: MetadataRelationScopes<T>
    }

export type MetadataUpdateInput<T extends EntryType> =
  | {
      readonly type: 'profile'
      readonly profileId: string
      readonly clues?: IdentificationClues<T>
    }
  | {
      readonly type: 'prepared'
      readonly data: MetadataCandidate<T>
      readonly relationScopes?: MetadataRelationScopes<T>
    }

/** Parse a profile/prepared input in the actual root context. Prepared data is a candidate, never a local graph patch. */
export function parseMetadataInput<T extends EntryType>(root: T, input: unknown): MetadataInput<T> {
  return parseMetadataSource(root, input, false) as MetadataInput<T>
}

/** Update can derive omitted profile clues from the fixed local target; prepared data still has a complete candidate root. */
export function parseMetadataUpdateInput<T extends EntryType>(
  root: T,
  input: unknown,
): MetadataUpdateInput<T> {
  return parseMetadataSource(root, input, true) as MetadataUpdateInput<T>
}

function parseMetadataSource(
  root: EntryType,
  input: unknown,
  update: boolean,
): MetadataInput<EntryType> | MetadataUpdateInput<EntryType> {
  const clues = v.pipe(
    v.unknown(),
    v.transform((value) => parseIdentificationClues(root, value)),
  )
  const data = v.pipe(
    v.unknown(),
    v.transform(parseMetadataCandidate),
    v.check((value) => value.entryType === root),
  )
  return parseValue(
    v.variant('type', [
      v.strictObject({
        type: v.literal('profile'),
        profileId: id,
        clues: update ? v.exactOptional(clues) : clues,
      }),
      v.strictObject({
        type: v.literal('prepared'),
        data,
        relationScopes: v.exactOptional(
          v.pipe(
            v.unknown(),
            v.transform((value) => parseMetadataRelationScopes(root, value)),
          ),
        ),
      }),
    ]),
    input,
    'Invalid metadata adoption source',
  )
}
