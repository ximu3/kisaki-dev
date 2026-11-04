/** @fileoverview Defines metadata object identities, root-specific part slots and shared node shapes. */

import type { ExternalIdentity, EntryType, PartType } from '../library/catalog'
import type {
  IdentificationFields,
  PartIdentificationFields,
  MetadataEntryFields,
  MetadataPartFields,
} from './fields'
import { id, optionalFields, text } from '../validation'
import * as v from 'valibot'
import { identitySchema, identitiesSchema, identityKey, entryTypes } from '../library/catalog'
import { DesktopError } from '../errors'
import {
  metadataEntryEntries,
  metadataPartEntries,
  parseIdentificationFields,
  parseMetadataEntryFields,
  parsePartIdentificationFields,
  parseMetadataPartFields,
} from './fields'

export interface ParsedNode {
  readonly key: string
  readonly identity?: ExternalIdentity
  readonly externalIdentities?: readonly ExternalIdentity[]
}

interface ParsedCandidateNode extends ParsedNode {
  readonly identification: IdentificationFields<EntryType> | PartIdentificationFields<PartType>
  readonly fields: MetadataEntryFields<EntryType> | MetadataPartFields<PartType>
}

export interface ParsedObjects {
  readonly entry?: ParsedNode
  readonly relatedEntries?: Partial<Record<EntryType, readonly ParsedNode[]>>
  readonly parts?: Readonly<Partial<Record<string, readonly ParsedNode[]>>>
  readonly tags?: readonly CandidateTag[]
}

interface ParsedCandidateObjects extends ParsedObjects {
  readonly entry: ParsedCandidateNode
  readonly relatedEntries?: Partial<Record<EntryType, readonly ParsedCandidateNode[]>>
  readonly parts?: Readonly<Partial<Record<string, readonly ParsedCandidateNode[]>>>
}

const identityEntries = {
  key: id,
  identity: v.exactOptional(identitySchema),
  externalIdentities: v.exactOptional(identitiesSchema),
}

function checkIdentities<T extends ParsedNode>(node: T): T {
  if (
    node.identity &&
    node.externalIdentities?.some(
      (identity) => identityKey(identity) === identityKey(node.identity!),
    )
  ) {
    throw new DesktopError(
      'InvalidInput',
      'Additional metadata identities must exclude the primary identity',
    )
  }

  return node
}

function sourceEntry(type: EntryType): v.GenericSchema<unknown, ParsedNode> {
  return v.pipe(
    v.strictObject({ ...identityEntries, ...optionalFields(metadataEntryEntries(type)) }),
    v.transform(checkIdentities),
  )
}

function sourcePart(type: PartType): v.GenericSchema<unknown, ParsedNode> {
  return v.pipe(
    v.strictObject({ ...identityEntries, ...optionalFields(metadataPartEntries(type)) }),
    v.transform(checkIdentities),
  )
}

function candidateEntry(type: EntryType): v.GenericSchema<unknown, ParsedCandidateNode> {
  return v.pipe(
    v.strictObject({
      ...identityEntries,
      identification: v.pipe(
        v.unknown(),
        v.transform((value) => parseIdentificationFields(type, value)),
      ),
      fields: v.pipe(
        v.unknown(),
        v.transform((value) => parseMetadataEntryFields(type, value)),
      ),
    }),
    v.transform(checkIdentities),
  )
}

function candidatePart(type: PartType): v.GenericSchema<unknown, ParsedCandidateNode> {
  return v.pipe(
    v.strictObject({
      ...identityEntries,
      identification: v.pipe(
        v.unknown(),
        v.transform((value) => parsePartIdentificationFields(type, value)),
      ),
      fields: v.pipe(
        v.unknown(),
        v.transform((value) => parseMetadataPartFields(type, value)),
      ),
    }),
    v.transform(checkIdentities),
  )
}

export function objectsSchema(
  root: EntryType,
  composed: true,
): v.GenericSchema<unknown, ParsedCandidateObjects>

export function objectsSchema(
  root: EntryType,
  composed: false,
): v.GenericSchema<unknown, ParsedObjects>

export function objectsSchema(
  root: EntryType,
  composed: boolean,
): v.GenericSchema<unknown, ParsedObjects> {
  const entry = composed ? candidateEntry : sourceEntry
  const part = composed ? candidatePart : sourcePart
  const related = Object.fromEntries(
    entryTypes.map((type) => [type, v.exactOptional(v.array(entry(type)))]),
  )

  const parts = Object.fromEntries(
    Object.entries(metadataPartKinds[root]).map(([slot, type]) => [
      slot,
      v.exactOptional(v.array(part(type))),
    ]),
  )

  const tag = v.strictObject({
    key: id,
    name: v.pipe(
      text,
      v.check((value) => value.trim().length > 0),
    ),
    description: v.exactOptional(v.nullable(text)),
    isNsfw: v.exactOptional(v.boolean()),
  })
  return v.strictObject({
    entry: composed ? entry(root) : v.exactOptional(entry(root)),
    relatedEntries: v.exactOptional(v.strictObject(related)),
    parts: v.exactOptional(Object.keys(parts).length > 0 ? v.strictObject(parts) : v.never()),
    tags: v.exactOptional(v.array(tag)),
  })
}

export interface CandidateTag {
  readonly key: string
  readonly name: string
  readonly description?: string | null
  readonly isNsfw?: boolean
}

/** Only these part slots exist in a root context; they do not introduce independent Part search or resolve roots. */
export interface MetadataPartKinds {
  readonly game: Readonly<Record<never, never>>
  readonly anime: { readonly episode: 'animeEpisode'; readonly extra: 'animeExtra' }
  readonly comic: { readonly volume: 'comicVolume'; readonly chapter: 'comicChapter' }
  readonly novel: { readonly volume: 'novelVolume' }
  readonly character: Readonly<Record<never, never>>
  readonly person: Readonly<Record<never, never>>
  readonly organization: Readonly<Record<never, never>>
}

export type MetadataPartKey<T extends EntryType> = keyof MetadataPartKinds[T]

export type MetadataPartType<T extends EntryType, K extends MetadataPartKey<T>> = Extract<
  MetadataPartKinds[T][K],
  PartType
>

export interface ObjectFieldRequest<Field extends PropertyKey> {
  readonly fields: readonly Field[]
  readonly refs?: readonly ExternalIdentity[]
}

/** Provider values are direct field answers; primary/additional identities are supplied whenever genuinely known. */
export interface MetadataObjectIdentity {
  readonly key: string
  readonly identity?: ExternalIdentity
  readonly externalIdentities?: readonly ExternalIdentity[]
}

/** Actual root-specific part kinds are shared by all metadata directories, avoiding copied volume meanings. */
export const metadataPartKinds: MetadataPartKinds = {
  game: {},
  anime: { episode: 'animeEpisode', extra: 'animeExtra' },
  comic: { volume: 'comicVolume', chapter: 'comicChapter' },
  novel: { volume: 'novelVolume' },
  character: {},
  person: {},
  organization: {},
}
