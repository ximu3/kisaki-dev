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

/**
 * A profile with identification clues or a prepared source candidate for initial adoption.
 *
 * Prepared candidates contain source facts and completeness evidence, rather than local graph
 * patches.
 */
export type MetadataInput<T extends EntryType> =
  | { readonly type: 'profile'; readonly profileId: string; readonly clues: IdentificationClues<T> }
  | {
      readonly type: 'prepared'
      readonly data: MetadataCandidate<T>
      readonly relationScopes?: MetadataRelationScopes<T>
    }

/**
 * A metadata source for updating a fixed local target.
 *
 * Profile clues may be omitted and derived from that target. Prepared input retains a complete
 * candidate root.
 */
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

/** Parses a profile or prepared source candidate for the actual root-entry type. */
export function parseMetadataInput<T extends EntryType>(root: T, input: unknown): MetadataInput<T> {
  return parseMetadataSource(root, input, false) as MetadataInput<T>
}

/** Parses an update source, allowing profile clues to be derived later from the fixed target. */
export function parseMetadataUpdateInput<T extends EntryType>(
  root: T,
  input: unknown,
): MetadataUpdateInput<T> {
  return parseMetadataSource(root, input, true) as MetadataUpdateInput<T>
}

/** Parses root-specific profile or candidate data with the clue requirements for add or update. */
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
