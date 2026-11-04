/** @fileoverview Defines graph-local node references, create values and canonical reference keys. */

import type {
  EntryType,
  EntryRef,
  PartType,
  PartRef,
  EntryCreateInput,
  PartWorkType,
} from '../catalog'
import type { PartCreateFields } from '../parts'
import type { TagUpdate } from '../organizers'
import * as v from 'valibot'
import { id } from '../../validation'

/** Keys address creates in this request only; they are not local IDs and never refer to an update node. */
export type GraphEntryRef<T extends EntryType = EntryType> = EntryRef<T> | { readonly key: string }

export type GraphPartRef<T extends PartType = PartType> = PartRef<T> | { readonly key: string }

export type GraphTagRef = { readonly id: string } | { readonly key: string }

export interface GraphTagMember {
  readonly tagId: GraphTagRef
  readonly note?: string | null
  readonly isSpoiler?: boolean
}

export type GraphTagChange =
  | { readonly type: 'replace'; readonly items: readonly GraphTagMember[] }
  | {
      readonly type: 'modify'
      readonly add?: readonly GraphTagMember[]
      readonly remove?: readonly GraphTagRef[]
    }

/** Seven ordinary creation branches, additionally named within this request and able to reference a newly created tag. */
export type GraphEntryCreate = {
  [K in EntryType]: Omit<EntryCreateInput<K>, 'tags'> & {
    readonly key: string
    readonly tags?: readonly GraphTagMember[]
  }
}[EntryType]

export type GraphPartCreate = {
  [K in PartType]: {
    readonly key: string
    readonly type: K
    readonly work: GraphEntryRef<PartWorkType<K>>
    readonly data: PartCreateFields<K>
    readonly completed?: boolean
  }
}[PartType]

export interface GraphTagCreate {
  readonly key: string
  readonly name: string
  readonly description?: string | null
  readonly isNsfw?: boolean
}

export type GraphTagUpdate = { readonly id: string } & TagUpdate

export const keySchema = v.strictObject({ key: id })

export function entryKey(ref: GraphEntryRef): string {
  return 'key' in ref ? JSON.stringify(['key', ref.key]) : JSON.stringify(['entry', ref.id])
}

export function partKey(ref: GraphPartRef): string {
  return 'key' in ref
    ? JSON.stringify(['key', ref.key])
    : JSON.stringify(['part', ref.type, ref.id])
}

export function tagKey(ref: GraphTagRef): string {
  return 'key' in ref ? JSON.stringify(['key', ref.key]) : JSON.stringify(['tag', ref.id])
}
