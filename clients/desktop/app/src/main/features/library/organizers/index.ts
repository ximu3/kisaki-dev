import {
  parseCollectionCreate,
  parseCollectionUpdate,
  parseCollectionQuery,
  parseTagCreate,
  parseTagUpdate,
  parseTagQuery,
  parseDynamicRules,
  parseOrganizerMerge,
  parseMoveInput,
  parseReorderInput,
} from '@kisaki3/desktop-contracts/library'
import { parseListOptions, type CallOptions } from '@kisaki3/desktop-contracts/operations'
import type { DatabaseCall } from '../../../infrastructure/database/executor'
import type { createAttachments } from '../../../infrastructure/attachments'
import { imageIds, prepareImages } from '../attachments'
import type { CompleteWrite } from '../transaction'
import type { organizerStorage } from './catalog'

import { memberships } from './membership'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
export function createOrganizers(
  call: DatabaseCall<ReturnType<typeof organizerStorage>>,
  attachments: ReturnType<typeof createAttachments>,
  sensitive: () => boolean,
  complete: CompleteWrite,
) {
  async function create(kind: 'collection' | 'tag', raw: unknown, options?: CallOptions) {
    const input = kind === 'collection' ? parseCollectionCreate(raw) : parseTagCreate(raw)
    options?.signal?.throwIfAborted()
    const hold = await prepareImages(attachments, imageIds(input), input.prepared ?? [])
    try {
      options?.signal?.throwIfAborted()
      const value = { ...input }
      delete value.prepared
      const result =
        kind === 'collection'
          ? await call('addLibraryCollection', value, hold.records, sensitive())
          : await call('addLibraryTag', value, hold.records)
      return complete(result)
    } finally {
      await hold.dispose()
    }
  }

  async function update(
    kind: 'collection' | 'tag',
    id: string,
    raw: unknown,
    options?: CallOptions,
  ) {
    const input = kind === 'collection' ? parseCollectionUpdate(raw) : parseTagUpdate(raw)
    options?.signal?.throwIfAborted()
    const hold = await prepareImages(attachments, imageIds(input.changes), input.prepared ?? [])
    try {
      options?.signal?.throwIfAborted()
      const value = { ...input }
      delete value.prepared
      const result =
        kind === 'collection'
          ? await call('editLibraryCollection', id, value, hold.records, sensitive())
          : await call('editLibraryTag', id, value, hold.records)
      complete(result)
    } finally {
      await hold.dispose()
    }
  }

  async function remove(kind: 'tag' | 'collection', id: string, options?: CallOptions) {
    options?.signal?.throwIfAborted()
    complete(await call('deleteOrganizer', kind, id))
  }

  const membership = memberships(call, complete, sensitive)
  async function merge(kind: 'tag' | 'collection', input: unknown, options?: CallOptions) {
    options?.signal?.throwIfAborted()
    return complete(await call('mergeOrganizers', kind, parseOrganizerMerge(input)))
  }
  return {
    collections: {
      members: membership.members,
      merge: (raw: unknown, options?: CallOptions) => merge('collection', raw, options),
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
      create: (input: unknown, options?: CallOptions) => create('collection', input, options),
      update: (id: string, input: unknown, options?: CallOptions) =>
        update('collection', id, input, options),
      delete: (id: string, options?: CallOptions) => remove('collection', id, options),
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
    },
    tags: {
      entries: membership.entries,
      merge: (raw: unknown, options?: CallOptions) => merge('tag', raw, options),
      findByName: (name: string) => call('findTagByName', name, sensitive()),
      list: (query: unknown, options: unknown) =>
        call('listLibraryTags', parseTagQuery(query), parseListOptions(options), sensitive()),
      get: (id: string) => call('readLibraryTag', id, sensitive()),
      create: (input: unknown, options?: CallOptions) => create('tag', input, options),
      update: (id: string, input: unknown, options?: CallOptions) =>
        update('tag', id, input, options),
      delete: (id: string, options?: CallOptions) => remove('tag', id, options),
    },
  }
}
