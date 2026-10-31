/** @fileoverview Defines unprocessed source identification fields and explicit lookup clues by entry kind. */

import * as v from 'valibot'
import { objectSchema } from '../schema'
import { partialDateSchema, type PartialDate } from '../date'
import { exactPartialEntries, nonemptyStringSchema, parseContract } from '../validation'
import { externalIdentitiesSchema, genders, type Gender } from '../library/catalog'
import type { EntryType, ExternalIdentity, PartType } from '../library/identity'
import {
  animeEpisodeTypes,
  animeExtraTypes,
  type AnimeEpisodeType,
  type AnimeExtraType,
} from '../library/parts'

const names = {
  name: nonemptyStringSchema,
  originalName: nonemptyStringSchema,
  aliases: v.pipe(v.array(nonemptyStringSchema), v.readonly()),
}
const work = { ...names, releaseDate: partialDateSchema }
export const identificationFields = {
  game: exactPartialEntries(work),
  anime: exactPartialEntries({ ...work, releaseEndDate: partialDateSchema }),
  comic: exactPartialEntries({ ...work, releaseEndDate: partialDateSchema }),
  novel: exactPartialEntries({ ...work, releaseEndDate: partialDateSchema }),
  character: exactPartialEntries({
    ...names,
    birthDate: partialDateSchema,
    gender: v.picklist(genders),
  }),
  person: exactPartialEntries({
    ...names,
    birthDate: partialDateSchema,
    deathDate: partialDateSchema,
    gender: v.picklist(genders),
  }),
  organization: exactPartialEntries({
    ...names,
    foundedDate: partialDateSchema,
    dissolvedDate: partialDateSchema,
  }),
}

/** Only known unprocessed values appear; unknown/null ordinary metadata does not become an identity clue. */
export type IdentificationFields<Type extends EntryType = EntryType> = {
  readonly name?: string
  readonly originalName?: string
  readonly aliases?: readonly string[]
} & {
  game: { readonly releaseDate?: PartialDate }
  anime: { readonly releaseDate?: PartialDate; readonly releaseEndDate?: PartialDate }
  comic: { readonly releaseDate?: PartialDate; readonly releaseEndDate?: PartialDate }
  novel: { readonly releaseDate?: PartialDate; readonly releaseEndDate?: PartialDate }
  character: { readonly birthDate?: PartialDate; readonly gender?: Gender }
  person: {
    readonly birthDate?: PartialDate
    readonly deathDate?: PartialDate
    readonly gender?: Gender
  }
  organization: { readonly foundedDate?: PartialDate; readonly dissolvedDate?: PartialDate }
}[Type]
/** Explicit identities coexist with ordinary clues and always retain their own full source meaning. */
export type IdentificationClues<Type extends EntryType = EntryType> = IdentificationFields<Type> & {
  readonly externalIdentities?: readonly ExternalIdentity[]
}
/** Work-only clues supplied to recognizers; they do not authorize a local write. */
export interface WorkClues {
  readonly name?: string
  readonly originalName?: string
  readonly releaseDate?: PartialDate
  readonly externalIdentities?: readonly ExternalIdentity[]
}

/** Parse the finite recognizer vocabulary without accepting other source metadata or local decisions. */
export function parseWorkClues(input: unknown): WorkClues {
  return parseContract(
    objectSchema({
      name: v.exactOptional(nonemptyStringSchema),
      originalName: v.exactOptional(nonemptyStringSchema),
      releaseDate: v.exactOptional(partialDateSchema),
      externalIdentities: v.exactOptional(externalIdentitiesSchema),
    }),
    input,
    'work clues',
  )
}

const externalIdentities = v.exactOptional(externalIdentitiesSchema)
const clueSchemas: { [Type in EntryType]: v.GenericSchema<unknown, IdentificationClues<Type>> } = {
  game: objectSchema({ ...identificationFields.game, externalIdentities }),
  anime: objectSchema({ ...identificationFields.anime, externalIdentities }),
  comic: objectSchema({ ...identificationFields.comic, externalIdentities }),
  novel: objectSchema({ ...identificationFields.novel, externalIdentities }),
  character: objectSchema({ ...identificationFields.character, externalIdentities }),
  person: objectSchema({ ...identificationFields.person, externalIdentities }),
  organization: objectSchema({ ...identificationFields.organization, externalIdentities }),
}

/** Parse only the identification fields applicable to this root kind, preserving their known precision. */
export function parseIdentificationClues<Type extends EntryType>(
  type: Type,
  input: unknown,
): IdentificationClues<Type> {
  return parseContract(clueSchemas[type], input, 'identification clues')
}

/** Unprocessed Part clues. Volume-scoped chapter numbers remain on volumeChapters, not on the Part. */
export type PartIdentificationFields<Type extends PartType> = {
  readonly name?: string
  readonly originalName?: string
  readonly aliases?: readonly string[]
  readonly releaseDate?: PartialDate
} & {
  animeEpisode: { readonly numberLabel?: string; readonly type?: AnimeEpisodeType }
  animeExtra: { readonly type?: AnimeExtraType }
  comicVolume: { readonly numberLabel?: string }
  comicChapter: { readonly numberLabel?: string }
  novelVolume: { readonly numberLabel?: string }
}[Type]

const partNames = { ...names, releaseDate: partialDateSchema }
export const partIdentificationFields = {
  animeEpisode: exactPartialEntries({
    ...partNames,
    numberLabel: nonemptyStringSchema,
    type: v.picklist(animeEpisodeTypes),
  }),
  animeExtra: exactPartialEntries({ ...partNames, type: v.picklist(animeExtraTypes) }),
  comicVolume: exactPartialEntries({ ...partNames, numberLabel: nonemptyStringSchema }),
  comicChapter: exactPartialEntries({ ...partNames, numberLabel: nonemptyStringSchema }),
  novelVolume: exactPartialEntries({ ...partNames, numberLabel: nonemptyStringSchema }),
}
