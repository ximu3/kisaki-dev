import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseEntryRef,
  parseOrganizerMerge,
  parseCollectionMemberChange,
  parseTagEntryChange,
  parseMoveInput,
  parseReorderInput,
  type MoveInput,
  type EntryRef,
} from '@kisaki3/desktop-contracts/library'
import { parseListOptions } from '@kisaki3/desktop-contracts/operations'
import { rpcData } from '../../../../../shared/window-api/protocol'
import type { Application } from '../../../compose'
import { textArgument } from '../../values'
import { windowMethod } from '../../admission'
import type { PreparedInput } from './images'
export function organizerMethods(
  { collections, tags }: Application['library'],
  entryInput: PreparedInput,
) {
  function kind(raw: unknown) {
    if (raw === 'collection' || raw === 'tag') {
      return raw
    }
    throw new DesktopError('InvalidInput', 'Choose a collection or tag')
  }
  return {
    'library.collections.list': windowMethod('read', async ([raw, options]) =>
      rpcData(await collections.list(raw, options)),
    ),
    'library.collections.get': windowMethod('read', async ([id]) =>
      rpcData(await collections.get(textArgument(id))),
    ),
    'library.collections.create': windowMethod('write', ([raw, ids], signal) =>
      collections.create(entryInput(raw, ids), { signal }),
    ),
    'library.collections.update': windowMethod('write', ([id, raw, ids], signal) =>
      collections.update(textArgument(id), entryInput(raw, ids), { signal }),
    ),
    'library.collections.delete': windowMethod('write', ([id], signal) =>
      collections.delete(textArgument(id), { signal }),
    ),
    'library.collections.convertToManual': windowMethod('write', ([id, raw], signal) =>
      collections.convertToManual(
        textArgument(id),
        { expected: { dynamicRules: raw } },
        { signal },
      ),
    ),
    'library.tags.list': windowMethod('read', async ([raw, options]) =>
      rpcData(await tags.list(raw, options)),
    ),
    'library.tags.get': windowMethod('read', async ([id]) =>
      rpcData(await tags.get(textArgument(id))),
    ),
    'library.tags.create': windowMethod('write', ([raw, ids], signal) =>
      tags.create(entryInput(raw, ids), { signal }),
    ),
    'library.tags.update': windowMethod('write', ([id, raw, ids], signal) =>
      tags.update(textArgument(id), entryInput(raw, ids), { signal }),
    ),
    'library.tags.delete': windowMethod('write', ([id], signal) =>
      tags.delete(textArgument(id), { signal }),
    ),
    'library.organizers.merge': windowMethod('write', async ([raw, input], signal) =>
      rpcData(
        await (kind(raw) === 'collection' ? collections : tags).merge(parseOrganizerMerge(input), {
          signal,
        }),
      ),
    ),
    'library.organizers.members': windowMethod('read', async ([raw, id, range], signal) =>
      rpcData(
        await (kind(raw) === 'collection' ? collections.members : tags.entries).list(
          textArgument(id),
          parseListOptions(range),
          { signal },
        ),
      ),
    ),
    'library.organizers.changeMembers': windowMethod('write', ([raw, id, change], signal) =>
      kind(raw) === 'collection'
        ? collections.members.applyChanges(
            textArgument(id),
            { change: parseCollectionMemberChange(change) },
            { signal },
          )
        : tags.entries.applyChanges(
            textArgument(id),
            { change: parseTagEntryChange(change) },
            { signal },
          ),
    ),
    'library.organizers.updateMember': windowMethod(
      'write',
      ([raw, id, ref, changes, expected], signal) => {
        if (
          !changes ||
          !expected ||
          typeof changes !== 'object' ||
          typeof expected !== 'object' ||
          Array.isArray(changes) ||
          Array.isArray(expected)
        ) {
          throw new DesktopError('InvalidInput', 'Invalid member fields')
        }
        if (kind(raw) === 'collection') {
          if (
            Object.keys(changes).some((k) => k !== 'note') ||
            Object.keys(expected).some((k) => k !== 'note')
          ) {
            throw new DesktopError('InvalidInput', 'Only collection member notes can be edited')
          }
          return collections.members.update(
            textArgument(id),
            parseEntryRef(ref),
            {
              note: Reflect.get(changes, 'note') as string | null,
              expected: expected as { note: string | null },
            },
            { signal },
          )
        }
        return tags.entries.update(
          textArgument(id),
          parseEntryRef(ref),
          { changes, expected } as Parameters<typeof tags.entries.update>[2],
          { signal },
        )
      },
    ),
    'library.organizers.moveMember': windowMethod('write', ([raw, id, input], signal) =>
      (kind(raw) === 'collection' ? collections.members : tags.entries).move(
        textArgument(id),
        input as unknown as MoveInput<EntryRef>,
        { signal },
      ),
    ),
    'library.collections.move': windowMethod('write', ([input], signal) =>
      collections.move(parseMoveInput(input), { signal }),
    ),
    'library.collections.reorder': windowMethod('write', ([input], signal) =>
      collections.reorder(parseReorderInput(input), { signal }),
    ),
  }
}
