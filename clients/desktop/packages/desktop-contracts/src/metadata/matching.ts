/** @fileoverview Defines explicit ordered source and same-work Part matching rules. */

import * as v from 'valibot'
import type { EntryType, PartType } from '../library/identity'
import { objectSchema } from '../schema'
import { exactPartialEntries, parseContract } from '../validation'
import {
  identificationFields,
  partIdentificationFields,
  type IdentificationFields,
  type PartIdentificationFields,
} from './identification'

/** Each composite rule requires every field; order is the fallback order, never a score. */
export interface MatchingRule<Field extends string> {
  readonly fields: readonly Field[]
}
export type EntryMatchingRules = {
  readonly [Type in EntryType]?: readonly MatchingRule<
    Extract<keyof IdentificationFields<Type>, string>
  >[]
}
export type PartMatchingField<Type extends PartType> =
  | Extract<keyof PartIdentificationFields<Type>, string>
  | (Type extends 'comicChapter' ? 'volumeNumberLabel' : never)
export type PartMatchingRules<Type extends EntryType> = {
  game: never
  anime: {
    readonly episode?: readonly MatchingRule<PartMatchingField<'animeEpisode'>>[]
    readonly extra?: readonly MatchingRule<PartMatchingField<'animeExtra'>>[]
  }
  comic: {
    readonly volume?: readonly MatchingRule<PartMatchingField<'comicVolume'>>[]
    readonly chapter?: readonly MatchingRule<PartMatchingField<'comicChapter'>>[]
  }
  novel: { readonly volume?: readonly MatchingRule<PartMatchingField<'novelVolume'>>[] }
  character: never
  person: never
  organization: never
}[Type]
/** Entry keys and root-scoped Part keys share one fixed matching group in a Profile. */
export type MetadataMatching<Type extends EntryType> = EntryMatchingRules &
  (Type extends 'anime' | 'comic' | 'novel' ? PartMatchingRules<Type> : object)

function rules<Entries extends v.ObjectEntries>(fields: Entries) {
  return v.pipe(
    v.array(
      objectSchema({
        fields: v.pipe(
          v.array(v.keyof(v.strictObject(fields))),
          v.minLength(1),
          v.check((values) => new Set(values).size === values.length),
          v.readonly(),
        ),
      }),
    ),
    v.readonly(),
  )
}
const entryRules = {
  game: rules(identificationFields.game),
  anime: rules(identificationFields.anime),
  comic: rules(identificationFields.comic),
  novel: rules(identificationFields.novel),
  character: rules(identificationFields.character),
  person: rules(identificationFields.person),
  organization: rules(identificationFields.organization),
}
const animeRules = {
  episode: rules(partIdentificationFields.animeEpisode),
  extra: rules(partIdentificationFields.animeExtra),
}
const comicRules = {
  volume: rules(partIdentificationFields.comicVolume),
  chapter: rules({ ...partIdentificationFields.comicChapter, volumeNumberLabel: v.string() }),
}
const novelRules = { volume: rules(partIdentificationFields.novelVolume) }
export const partMatchingSchemas: {
  [Type in EntryType]: v.GenericSchema<unknown, PartMatchingRules<Type>>
} = {
  game: v.never(),
  anime: objectSchema(exactPartialEntries(animeRules)),
  comic: objectSchema(exactPartialEntries(comicRules)),
  novel: objectSchema(exactPartialEntries(novelRules)),
  character: v.never(),
  person: v.never(),
  organization: v.never(),
}
export const metadataMatchingSchemas: {
  [Type in EntryType]: v.GenericSchema<unknown, MetadataMatching<Type>>
} = {
  game: objectSchema(exactPartialEntries(entryRules)),
  anime: objectSchema(exactPartialEntries({ ...entryRules, ...animeRules })),
  comic: objectSchema(exactPartialEntries({ ...entryRules, ...comicRules })),
  novel: objectSchema(exactPartialEntries({ ...entryRules, ...novelRules })),
  character: objectSchema(exactPartialEntries(entryRules)),
  person: objectSchema(exactPartialEntries(entryRules)),
  organization: objectSchema(exactPartialEntries(entryRules)),
}

/** Check applicable composite fields and exact optional Part keys; no missing rule is supplied implicitly. */
export function parsePartMatchingRules<Type extends EntryType>(
  type: Type,
  input: unknown,
): PartMatchingRules<Type> {
  return parseContract(partMatchingSchemas[type], input, 'part matching rules')
}

/** Normalize names only for explicit matching rules; never use this transformation for source identities. */
export function matchingName(value: string): string {
  return value
    .normalize('NFC')
    .trim()
    .replace(/\s+/gu, ' ')
    .replace(/[A-Z]/g, (letter) => letter.toLowerCase())
}
