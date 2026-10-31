/** @fileoverview Owns catalog type vocabularies and stable local and external references. */

import * as v from 'valibot'
import { objectSchema } from '../schema'
import { nonemptyStringSchema, parseContract } from '../validation'

/** The seven independently cataloged entry kinds. */
export const entryTypes = [
  'game',
  'anime',
  'comic',
  'novel',
  'character',
  'person',
  'organization',
] as const
/** Entry kinds with use sessions and personal work records. */
export const workTypes = ['game', 'anime', 'comic', 'novel'] as const
/** Real, independently described parts; game installations are not catalog parts. */
export const partTypes = [
  'novelVolume',
  'comicVolume',
  'comicChapter',
  'animeEpisode',
  'animeExtra',
] as const
export type EntryType = (typeof entryTypes)[number]
export type WorkType = (typeof workTypes)[number]
export type PartType = (typeof partTypes)[number]

/** Stable local identity. The operation must still verify the actual kind and visibility. */
export interface EntryRef<Type extends EntryType = EntryType> {
  readonly type: Type
  readonly id: string
}
/** Work references are the applicable subset of the same entry identities. */
export type WorkRef = EntryRef<WorkType>
/** Stable part identity; the owner work is deliberately not duplicated here. */
export interface PartRef<Type extends PartType = PartType> {
  readonly type: Type
  readonly id: string
}
/** An opaque, complete source resource identity, compared without case folding or truncation. */
export interface ExternalIdentity {
  readonly source: string
  readonly sourceId: string
}
/** A root entry lookup in the receiving library. External IDs never implicitly identify a part. */
export type EntryIdentifier =
  | { readonly type: 'local'; readonly id: string }
  | ({ readonly type: 'external' } & ExternalIdentity)

export const entryRefSchema = objectSchema({
  type: v.picklist(entryTypes),
  id: nonemptyStringSchema,
})
export const workRefSchema = objectSchema({ type: v.picklist(workTypes), id: nonemptyStringSchema })
export const partRefSchema = objectSchema({ type: v.picklist(partTypes), id: nonemptyStringSchema })
export const externalIdentityFields = {
  source: v.pipe(nonemptyStringSchema, v.regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/)),
  sourceId: nonemptyStringSchema,
}
export const externalIdentitySchema = objectSchema(externalIdentityFields)
export const entryIdentifierSchema = v.union([
  objectSchema({ type: v.literal('local'), id: nonemptyStringSchema }),
  objectSchema({ type: v.literal('external'), ...externalIdentityFields }),
])

/** Parse a catalog reference; storage existence and visibility belong to the read or write operation. */
export function parseEntryRef(value: unknown): EntryRef {
  return parseContract(entryRefSchema, value, 'entry reference')
}
/** Parse a work reference without allowing characters, people, or organizations. */
export function parseWorkRef(value: unknown): WorkRef {
  return parseContract(workRefSchema, value, 'work reference')
}
/** Parse a part reference without guessing a table from its ID. */
export function parsePartRef(value: unknown): PartRef {
  return parseContract(partRefSchema, value, 'part reference')
}
/** Parse an external identity while preserving the complete source-defined sourceId. */
export function parseExternalIdentity(value: unknown): ExternalIdentity {
  return parseContract(externalIdentitySchema, value, 'external identity')
}
/** Parse a public root lookup, without querying a source or the database. */
export function parseEntryIdentifier(value: unknown): EntryIdentifier {
  return parseContract(entryIdentifierSchema, value, 'entry identifier')
}

/** Exact tuple encoding for in-memory set membership, not a persisted replacement identity. */
export function externalIdentityKey(identity: ExternalIdentity): string {
  return JSON.stringify([identity.source, identity.sourceId])
}
