import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseCollectionCreate,
  parseCollectionMemberChange,
  parseCollectionQuery,
  parseCollectionUpdate,
  parseDynamicRules,
  parseEntryRef,
  parseMoveInput,
  parseReorderInput,
  type CollectionMember,
  type CollectionMembersApi,
} from '@kisaki3/desktop-contracts/library'
import { parseListOptions, type CallOptions } from '@kisaki3/desktop-contracts/operations'
import * as v from 'valibot'
import type { CompleteWrite } from '../../transaction'
import type { OrganizerCall, OrganizerWrites } from '../write'
import { entryMove, entryOrder, inputObject } from '../write'

export function createCollections(
  call: OrganizerCall,
  writes: OrganizerWrites,
  sensitive: () => boolean,
  complete: CompleteWrite,
) {
  return {
    members: collectionMembers(call, complete, sensitive),
    merge: (raw: unknown, options?: CallOptions) => writes.merge('collection', raw, options),
    async reorder(raw: unknown, options?: CallOptions) {
      options?.signal?.throwIfAborted()
      complete(await call('orderCollections', parseReorderInput(raw)))
    },
    async move(raw: unknown, options?: CallOptions) {
      options?.signal?.throwIfAborted()
      complete(await call('orderCollections', parseMoveInput(raw)))
    },
    list: (query: unknown, options: unknown) =>
      call(
        'listLibraryCollections',
        parseCollectionQuery(query),
        parseListOptions(options),
        sensitive(),
      ),
    get: (id: string) => call('readLibraryCollection', id, sensitive()),
    create(raw: unknown, options?: CallOptions) {
      const { prepared, ...input } = parseCollectionCreate(raw)
      return writes.save(input, prepared, options, (images) =>
        call('addLibraryCollection', input, images, sensitive()),
      )
    },
    update(id: string, raw: unknown, options?: CallOptions) {
      const { prepared, ...input } = parseCollectionUpdate(raw)
      return writes.save(input.changes, prepared, options, (images) =>
        call('editLibraryCollection', id, input, images, sensitive()),
      )
    },
    delete: (id: string, options?: CallOptions) => writes.remove('collection', id, options),
    async convertToManual(id: string, input: unknown, options?: CallOptions) {
      if (
        !input ||
        typeof input !== 'object' ||
        !('expected' in input) ||
        Object.keys(input).length !== 1 ||
        !input.expected ||
        typeof input.expected !== 'object' ||
        !('dynamicRules' in input.expected) ||
        Object.keys(input.expected).length !== 1
      ) {
        throw new DesktopError('InvalidInput', 'Provide the original dynamic rules')
      }
      const expected = input.expected.dynamicRules
      options?.signal?.throwIfAborted()
      complete(await call('manualizeCollection', id, parseDynamicRules(expected)))
    },
  }
}

function collectionMembers(
  call: OrganizerCall,
  complete: CompleteWrite,
  sensitive: () => boolean,
): CollectionMembersApi {
  const note = v.nullable(v.string())
  return {
    list: (id: string, range: unknown) =>
      call('listCollectionMembers', id, parseListOptions(range), sensitive()),
    async applyChanges(id: string, raw: unknown, options?: CallOptions) {
      const input = inputObject(
        v.strictObject({ change: v.unknown(), expected: v.exactOptional(v.array(v.unknown())) }),
        raw,
      )
      const change = parseCollectionMemberChange(input.change)
      let baseline: readonly CollectionMember[] | undefined
      if (input.expected !== undefined) {
        if (change.type !== 'replace') {
          throw new DesktopError('InvalidInput', 'Only replacement has a full member baseline')
        }
        const member = v.strictObject({ entry: v.unknown(), note })
        for (const value of input.expected) {
          inputObject(member, value)
        }
        const parsed = parseCollectionMemberChange({ type: 'replace', items: input.expected })
        if (parsed.type === 'replace') {
          baseline = parsed.items as readonly CollectionMember[]
        }
      }
      options?.signal?.throwIfAborted()
      complete(await call('editCollectionMembers', id, change, baseline))
    },
    async update(id: string, raw: unknown, input: unknown, options?: CallOptions) {
      const entry = parseEntryRef(raw)
      const value = inputObject(
        v.strictObject({ note, expected: v.exactOptional(v.strictObject({ note })) }),
        input,
      )
      options?.signal?.throwIfAborted()
      complete(
        await call('updateCollectionMember', id, entry, { note: value.note }, value.expected),
      )
    },
    async reorder(id, raw, options) {
      const { input, refs } = entryOrder(raw)
      options?.signal?.throwIfAborted()
      complete(await call('orderCollectionMembers', id, input, refs))
    },
    async move(id, raw, options) {
      const { input, refs } = entryMove(raw)
      options?.signal?.throwIfAborted()
      complete(await call('orderCollectionMembers', id, input, refs))
    },
  }
}
