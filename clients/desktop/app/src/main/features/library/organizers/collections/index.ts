import { parseListOptions, type CallOptions } from '@kisaki3/desktop-contracts/operations'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseCollectionCreate,
  parseCollectionQuery,
  parseCollectionUpdate,
  parseDynamicRules,
  parseReorderInput,
  parseMoveInput,
  type CollectionMembersApi,
} from '@kisaki3/desktop-contracts/library'
import type { OrganizerWrites, OrganizerCall } from '../writes'
import type { CompleteWrite } from '../../transaction'

export function createCollections(
  call: OrganizerCall,
  writes: OrganizerWrites,
  sensitive: () => boolean,
  complete: CompleteWrite,
  members: CollectionMembersApi,
) {
  return {
    members,
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
