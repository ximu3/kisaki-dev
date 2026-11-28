import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseEntryRef,
  parseTagCreate,
  parseTagEntryChange,
  parseTagQuery,
  parseTagUpdate,
  type TagEntriesApi,
  type TagEntry,
} from '@kisaki3/desktop-contracts/library'
import { parseListOptions, type CallOptions } from '@kisaki3/desktop-contracts/operations'
import * as v from 'valibot'
import type { CompleteWrite } from '../../transaction'
import type { OrganizerCall, OrganizerWrites } from '../write'
import { entryMove, entryOrder, inputObject } from '../write'

export function createTags(
  call: OrganizerCall,
  writes: OrganizerWrites,
  sensitive: () => boolean,
  complete: CompleteWrite,
) {
  return {
    entries: tagEntries(call, complete, sensitive),
    merge: (raw: unknown, options?: CallOptions) => writes.merge('tag', raw, options),
    findByName: (name: string) => call('findTagByName', name, sensitive()),
    list: (query: unknown, options: unknown) =>
      call('listLibraryTags', parseTagQuery(query), parseListOptions(options), sensitive()),
    get: (id: string) => call('readLibraryTag', id, sensitive()),
    create(raw: unknown, options?: CallOptions) {
      const { prepared, ...input } = parseTagCreate(raw)
      return writes.save(input, prepared, options, (images) => call('addLibraryTag', input, images))
    },
    update(id: string, raw: unknown, options?: CallOptions) {
      const { prepared, ...input } = parseTagUpdate(raw)
      return writes.save(input.changes, prepared, options, (images) =>
        call('editLibraryTag', id, input, images),
      )
    },
    delete: (id: string, options?: CallOptions) => writes.remove('tag', id, options),
  }
}

function tagEntries(
  call: OrganizerCall,
  complete: CompleteWrite,
  sensitive: () => boolean,
): TagEntriesApi {
  const note = v.nullable(v.string())
  const properties = { note: v.exactOptional(note), isSpoiler: v.exactOptional(v.boolean()) }
  return {
    list: (id: string, range: unknown) =>
      call('listTagEntries', id, parseListOptions(range), sensitive()),
    async applyChanges(id: string, raw: unknown, options?: CallOptions) {
      const input = inputObject(
        v.strictObject({ change: v.unknown(), expected: v.exactOptional(v.array(v.unknown())) }),
        raw,
      )
      const change = parseTagEntryChange(input.change)
      let baseline: readonly TagEntry[] | undefined
      if (input.expected !== undefined) {
        if (change.type !== 'replace') {
          throw new DesktopError('InvalidInput', 'Only replacement has a full member baseline')
        }
        const member = v.strictObject({ entry: v.unknown(), note, isSpoiler: v.boolean() })
        for (const value of input.expected) {
          inputObject(member, value)
        }
        const parsed = parseTagEntryChange({ type: 'replace', items: input.expected })
        if (parsed.type === 'replace') {
          baseline = parsed.items as readonly TagEntry[]
        }
      }
      options?.signal?.throwIfAborted()
      complete(await call('editTagEntries', id, change, baseline))
    },
    async update(id: string, raw: unknown, input: unknown, options?: CallOptions) {
      const entry = parseEntryRef(raw)
      const change = inputObject(
        v.strictObject({
          changes: v.strictObject(properties),
          expected: v.exactOptional(v.strictObject(properties)),
        }),
        input,
      )
      if (Object.keys(change.expected ?? {}).some((key) => !Object.hasOwn(change.changes, key))) {
        throw new DesktopError('InvalidInput', 'A baseline must refer to an edited attribute')
      }
      options?.signal?.throwIfAborted()
      complete(await call('updateTagEntry', id, entry, change.changes, change.expected))
    },
    async reorder(id, raw, options) {
      const { input, refs } = entryOrder(raw)
      options?.signal?.throwIfAborted()
      complete(await call('orderTagEntries', id, input, refs))
    },
    async move(id, raw, options) {
      const { input, refs } = entryMove(raw)
      options?.signal?.throwIfAborted()
      complete(await call('orderTagEntries', id, input, refs))
    },
  }
}
