import { parseListOptions, type CallOptions } from '@kisaki3/desktop-contracts/operations'
import {
  parseTagCreate,
  parseTagUpdate,
  parseTagQuery,
  type TagEntriesApi,
} from '@kisaki3/desktop-contracts/library'
import type { OrganizerWrites, OrganizerCall } from '../writes'

export function createTags(
  call: OrganizerCall,
  writes: OrganizerWrites,
  sensitive: () => boolean,
  entries: TagEntriesApi,
) {
  return {
    entries,
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
