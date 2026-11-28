import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { Application } from '../../../compose'
import { rpcData } from '../../../../../shared/window-api/protocol'
import { windowMethod } from '../../admission'
import { textArgument } from '../../values'
import {
  parseMoveInput,
  parseVolumeChapterChange,
  parsePartQuery,
  parsePartRef,
  parsePartCreate,
  type PartsApi,
} from '@kisaki3/desktop-contracts/library'
import { parseListOptions } from '@kisaki3/desktop-contracts/operations'
import { toggle } from '../../values'
import type { PreparedInput } from './images'
export function partMethods(parts: Application['library']['parts'], entryInput: PreparedInput) {
  return {
    'library.parts.list': windowMethod('read', async ([query, range]) =>
      rpcData(await parts.list(parsePartQuery(query), range)),
    ),
    'library.parts.move': windowMethod('write', ([scope, input], signal) =>
      parts.move(scope, input, { signal }),
    ),
    'library.volumeChapters.list': windowMethod('read', async ([id, range]) =>
      rpcData(await parts.volumeChapters.list(textArgument(id), parseListOptions(range))),
    ),
    'library.volumeChapters.applyChanges': windowMethod('write', ([id, change], signal) =>
      parts.volumeChapters.applyChanges(
        textArgument(id),
        { change: parseVolumeChapterChange(change) },
        { signal },
      ),
    ),
    'library.volumeChapters.update': windowMethod(
      'write',
      ([id, chapter, number, expected], signal) =>
        parts.volumeChapters.update(
          textArgument(id),
          textArgument(chapter),
          {
            numberLabel: number === null ? null : textArgument(number),
            expected: { numberLabel: expected === null ? null : textArgument(expected) },
          },
          { signal },
        ),
    ),
    'library.volumeChapters.move': windowMethod('write', ([id, input], signal) =>
      parts.volumeChapters.move(textArgument(id), parseMoveInput(input), { signal }),
    ),
    'library.parts.get': windowMethod('read', async ([ref]) =>
      rpcData(await parts.get(parsePartRef(ref))),
    ),
    'library.parts.create': windowMethod('write', async ([raw, ids], signal) =>
      rpcData(await parts.create(parsePartCreate(entryInput(raw, ids)), { signal })),
    ),
    'library.parts.update': windowMethod('write', ([raw, ids], signal) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !('ref' in raw)) {
        throw new DesktopError('InvalidInput', 'Expected a part update')
      }
      const { ref, ...fields } = raw
      return parts.update(ref, entryInput(fields, ids), { signal })
    }),
    'library.parts.setCompletedMany': windowMethod('write', ([refs, done], signal) =>
      parts.setCompletedMany(refs, toggle(done), { signal }),
    ),
    'library.parts.changeKind': windowMethod('write', async ([ref, raw, ids], signal) =>
      rpcData(
        await parts.changeKind(
          ...([ref, entryInput(raw, ids), { signal }] as unknown as Parameters<
            PartsApi['changeKind']
          >),
        ),
      ),
    ),
    'library.parts.merge': windowMethod('write', async ([raw], signal) =>
      rpcData(await parts.merge(raw as unknown as Parameters<PartsApi['merge']>[0], { signal })),
    ),
    'library.parts.delete': windowMethod('write', ([raw], signal) => parts.delete(raw, { signal })),
    'library.parts.reorder': windowMethod('write', ([scope, raw], signal) =>
      parts.reorder(scope, raw, { signal }),
    ),
  }
}
