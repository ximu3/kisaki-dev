import * as v from 'valibot'
import { DesktopError } from '../../errors'
import { id, parseValue } from '../../validation'
import {
  entryRefSchema,
  entryTypes,
  isWorkType,
  partTypes,
  type EntryType,
  type PartType,
  type WorkType,
} from '../catalog'
import { entryKey, keySchema, type GraphEntryRef, type GraphPartRef } from './nodes'

interface NodeCreates {
  readonly create?: readonly unknown[]
}

export type GraphReferences = ReturnType<typeof indexGraphReferences>

export function indexGraphReferences(input: {
  entries?: NodeCreates
  parts?: NodeCreates
  tags?: NodeCreates
}) {
  const keys = new Set<string>()
  const entries = new Map<string, EntryType>()
  const parts = new Map<string, { readonly type: PartType; readonly work: GraphEntryRef }>()
  const tags = new Set<string>()

  function addKey(key: string): void {
    if (keys.has(key)) {
      throw new DesktopError('InvalidInput', 'Create keys must be unique across the complete graph')
    }
    keys.add(key)
  }

  // Complete the create index first so graph references can point forward across regions.
  for (const item of input.entries?.create ?? []) {
    const node = parseValue(v.looseObject({ key: id, type: v.picklist(entryTypes) }), item)
    addKey(node.key)
    entries.set(node.key, node.type)
  }

  for (const item of input.parts?.create ?? []) {
    const node = parseValue(
      v.looseObject({
        key: id,
        type: v.picklist(partTypes),
        work: v.union([entryRefSchema, keySchema]),
      }),
      item,
    )
    addKey(node.key)
    parts.set(node.key, { type: node.type, work: node.work })
  }

  for (const item of input.tags?.create ?? []) {
    const node = parseValue(v.looseObject({ key: id }), item)
    addKey(node.key)
    tags.add(node.key)
  }

  function entryType(ref: GraphEntryRef): EntryType {
    if ('type' in ref) {
      return ref.type
    }

    const type = entries.get(ref.key)
    if (!type) {
      throw new DesktopError(
        'InvalidInput',
        'Graph reference does not identify an entry created in this request',
      )
    }
    return type
  }

  function workType(ref: GraphEntryRef<WorkType>): WorkType {
    const type = entryType(ref)
    if (!isWorkType(type)) {
      throw new DesktopError('InvalidInput', 'Graph reference must identify a work')
    }
    return type
  }

  function entryReference<T extends EntryType>(
    types: readonly T[],
  ): v.GenericSchema<unknown, GraphEntryRef<T>> {
    return v.pipe(
      v.union([v.strictObject({ type: v.picklist(types), id }), keySchema]),
      v.check((ref) => types.some((type) => type === entryType(ref))),
    )
  }

  function partReference<T extends PartType>(
    types: readonly T[],
  ): v.GenericSchema<unknown, GraphPartRef<T>> {
    return v.pipe(
      v.union([v.strictObject({ type: v.picklist(types), id }), keySchema]),
      v.check((ref) => {
        if ('type' in ref) {
          return true
        }

        const target = parts.get(ref.key)
        return target !== undefined && types.some((type) => type === target.type)
      }),
    )
  }

  const tagReference = v.pipe(
    v.union([v.strictObject({ id }), keySchema]),
    v.check((ref) => !('key' in ref) || tags.has(ref.key)),
  )

  function partOwner(part: GraphPartRef) {
    return 'key' in part ? parts.get(part.key)?.work : undefined
  }

  function requirePartOwner(part: GraphPartRef, work: GraphEntryRef | undefined) {
    const owner = partOwner(part)
    if (owner && work && entryKey(owner) !== entryKey(work)) {
      throw new DesktopError(
        'InvalidInput',
        'Graph parts and local files must share the same real work',
      )
    }
  }

  return { entryReference, partReference, tagReference, workType, partOwner, requirePartOwner }
}
