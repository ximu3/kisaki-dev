import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseMoveInput,
  parsePartRef,
  parseReorderInput,
  parseVolumeChapterChange,
  type VolumeChaptersApi,
} from '@kisaki3/desktop-contracts/library'
import { parseListOptions } from '@kisaki3/desktop-contracts/operations'
import type { DatabaseCall } from '../../../../../infrastructure/database/executor'
import type { CompleteWrite } from '../../../transaction'
import type { partStorage } from '../../storage'

export function volumeChapters(
  call: DatabaseCall<ReturnType<typeof partStorage>>,
  complete: CompleteWrite,
): VolumeChaptersApi {
  function volume(id: string) {
    return { type: 'comicVolume' as const, id: parsePartRef({ type: 'comicVolume', id }).id }
  }
  return {
    list: (id, range) => call('readVolumeMembers', volume(id), parseListOptions(range)),
    async applyChanges(id, input, options) {
      if (
        !input ||
        typeof input !== 'object' ||
        Object.keys(input).some((k) => k !== 'change' && k !== 'expected')
      ) {
        throw new DesktopError('InvalidInput', 'Invalid volume membership edit')
      }
      const change = parseVolumeChapterChange(input.change)
      const expected =
        input.expected === undefined
          ? undefined
          : parseVolumeChapterChange({ type: 'replace', items: input.expected })
      if (change.type === 'modify' && expected) {
        throw new DesktopError('InvalidInput', 'A full membership baseline requires replacement')
      }
      options?.signal?.throwIfAborted()
      complete(
        await call(
          'editVolumeMembers',
          volume(id),
          change,
          expected?.type === 'replace' ? expected.items : undefined,
        ),
      )
    },
    async update(id, chapter, input, options) {
      function check(value: unknown) {
        return value === null || typeof value === 'string'
      }
      if (
        !input ||
        !check(input.numberLabel) ||
        Object.keys(input).some((k) => k !== 'numberLabel' && k !== 'expected') ||
        (input.expected !== undefined &&
          (!input.expected ||
            Object.keys(input.expected).length !== 1 ||
            !check(input.expected.numberLabel)))
      ) {
        throw new DesktopError('InvalidInput', 'Invalid chapter number')
      }
      options?.signal?.throwIfAborted()
      complete(
        await call(
          'updateVolumeChapter',
          volume(id).id,
          parsePartRef({ type: 'comicChapter', id: chapter }).id,
          input.numberLabel,
          input.expected,
        ),
      )
    },
    async reorder(id, input, options) {
      options?.signal?.throwIfAborted()
      complete(await call('orderVolumeChapters', volume(id).id, parseReorderInput(input)))
    },
    async move(id, input, options) {
      options?.signal?.throwIfAborted()
      complete(await call('orderVolumeChapters', volume(id).id, parseMoveInput(input)))
    },
  }
}
