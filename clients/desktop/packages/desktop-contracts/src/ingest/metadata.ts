import type { EntryType } from '../library/catalog'
import * as v from 'valibot'
import { parseIdentificationClues, type IdentificationClues } from '../metadata/fields'
import { parseMetadataCandidate, type MetadataCandidate } from '../metadata/candidates'
import { fromParser, parseValue, id } from '../validation'
import { parseMetadataRelationScopes, type MetadataRelationScopes } from '../metadata/relations'

/**
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

function parseMetadataSource(
  root: EntryType,
  input: unknown,
  update: boolean,
): MetadataInput<EntryType> | MetadataUpdateInput<EntryType> {
  const clues = fromParser((value) => parseIdentificationClues(root, value))
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
          fromParser((value) => parseMetadataRelationScopes(root, value)),
        ),
      }),
    ]),
    input,
    'Invalid metadata adoption source',
  )
}
