/** @fileoverview Defines graph-local node references, create values and canonical reference keys. */

import type { EntryType, EntryRef, PartType, PartRef, EntryCreate, PartWorkType } from '../catalog'
import type { PartCreateFields } from '../parts'
import type { TagUpdate } from '../organizers'
import * as v from 'valibot'
import { id } from '../../validation'

/**
 * An existing entry reference or a key addressing a create in this request.
 *
 * Request-local keys are not saved IDs and cannot address update nodes.
 */
export type GraphEntryRef<T extends EntryType = EntryType> = EntryRef<T> | { readonly key: string }

/** An existing part reference or a key addressing a part create in this request. */
export type GraphPartRef<T extends PartType = PartType> = PartRef<T> | { readonly key: string }

/** An existing tag identity or a key addressing a tag create in this request. */
export type GraphTagRef = { readonly id: string } | { readonly key: string }

/** A graph tag membership with the ordinary optional note and spoiler attributes. */
export interface GraphTagMember {
  readonly tagId: GraphTagRef
  readonly note?: string | null
  readonly isSpoiler?: boolean
}

/**
 * Tag replacement or incremental membership intent using existing or request-local tag references.
 */
export type GraphTagChange =
  | { readonly type: 'replace'; readonly items: readonly GraphTagMember[] }
  | {
      readonly type: 'modify'
      readonly add?: readonly GraphTagMember[]
      readonly remove?: readonly GraphTagRef[]
    }

/** An ordinary entry creation named within the request, with references to existing or new tags. */
export type GraphEntryCreate = {
  [K in EntryType]: Omit<EntryCreate<K>, 'tags'> & {
    readonly key: string
    readonly tags?: readonly GraphTagMember[]
  }
}[EntryType]

/**
 * A request-local part creation with a typed work owner, part fields and optional completion mark.
 */
export type GraphPartCreate = {
  [K in PartType]: {
    readonly key: string
    readonly type: K
    readonly work: GraphEntryRef<PartWorkType<K>>
    readonly data: PartCreateFields<K>
    readonly completed?: boolean
  }
}[PartType]

/** A request-local tag creation with its name and optional descriptive fields. */
export interface GraphTagCreate {
  readonly key: string
  readonly name: string
  readonly description?: string | null
  readonly isNsfw?: boolean
}

/** An ordinary tag edit paired with an existing saved identity. */
export type GraphTagUpdate = { readonly id: string } & TagUpdate

export const keySchema = v.strictObject({ key: id })

/** Encodes a graph entry reference with separate namespaces for create keys and saved IDs. */
export function entryKey(ref: GraphEntryRef): string {
  return 'key' in ref ? JSON.stringify(['key', ref.key]) : JSON.stringify(['entry', ref.id])
}

/** Encodes a graph part reference, retaining the kind of saved part IDs. */
export function partKey(ref: GraphPartRef): string {
  return 'key' in ref
    ? JSON.stringify(['key', ref.key])
    : JSON.stringify(['part', ref.type, ref.id])
}

/** Encodes a graph tag reference with separate namespaces for create keys and saved IDs. */
export function tagKey(ref: GraphTagRef): string {
  return 'key' in ref ? JSON.stringify(['key', ref.key]) : JSON.stringify(['tag', ref.id])
}
