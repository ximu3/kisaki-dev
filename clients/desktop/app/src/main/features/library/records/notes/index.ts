import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseNoteCreate,
  parseNoteUpdate,
  parseNoteQuery,
  parseNoteEntryChange,
  parseEntryRef,
  parseReorderInput,
  parseMoveInput,
  type NotesApi,
  type NoteOrderScope,
} from '@kisaki3/desktop-contracts/library'
import { parseListOptions } from '@kisaki3/desktop-contracts/operations'
import type { DatabaseCall } from '../../../../infrastructure/database/executor'
import type { createAttachments } from '../../../../infrastructure/attachments'
import { prepareImages } from '../../attachments'
import type { CompleteWrite } from '../../transaction'
import { noteImages, type noteStorage } from './storage'

function orderScope(input: NoteOrderScope): NoteOrderScope {
  if (input && Object.keys(input).length === 2) {
    if (input.type === 'note' && typeof input.noteId === 'string' && input.noteId) {
      return { type: 'note', noteId: input.noteId }
    }
    if (input.type === 'entry') {
      return { type: 'entry', entry: parseEntryRef(input.entry) }
    }
  }
  throw new DesktopError('InvalidInput', 'Choose a note or an entry order')
}
export function createNotes(
  call: DatabaseCall<ReturnType<typeof noteStorage>>,
  attachments: ReturnType<typeof createAttachments>,
  complete: CompleteWrite,
  sensitive: () => boolean,
): NotesApi {
  return {
    list: (input, range) =>
      call('listNotes', parseNoteQuery(input), parseListOptions(range), sensitive()),
    get: (id) => call('getNote', id),
    async create(raw, options) {
      const { prepared = [], ...input } = parseNoteCreate(raw),
        hold = await prepareImages(attachments, noteImages(input), prepared)
      try {
        options?.signal?.throwIfAborted()
        return complete(await call('createNote', input, hold.records))
      } finally {
        await hold.dispose()
      }
    },
    async update(id, raw, options) {
      const { prepared = [], ...input } = parseNoteUpdate(raw),
        hold = await prepareImages(attachments, noteImages(input.changes), prepared)
      try {
        options?.signal?.throwIfAborted()
        complete(await call('editNote', id, input, hold.records))
      } finally {
        await hold.dispose()
      }
    },
    async delete(raw, options) {
      const ids = typeof raw === 'string' ? [raw] : raw
      if (
        !Array.isArray(ids) ||
        !ids.length ||
        new Set(ids).size !== ids.length ||
        ids.some((id) => typeof id !== 'string' || !id)
      ) {
        throw new DesktopError('InvalidInput', 'Choose one or more distinct notes')
      }
      options?.signal?.throwIfAborted()
      complete(await call('deleteNotes', ids))
    },
    entries: {
      list: (id, range) => call('listNoteEntries', id, parseListOptions(range), sensitive()),
      async applyChanges(id, input, options) {
        if (
          !input ||
          typeof input !== 'object' ||
          Object.keys(input).some((k) => k !== 'change' && k !== 'expected')
        ) {
          throw new DesktopError('InvalidInput', 'Invalid note membership')
        }
        const change = parseNoteEntryChange(input.change)
        if (change.type !== 'replace' && input.expected !== undefined) {
          throw new DesktopError('InvalidInput', 'An entry list baseline requires replacement')
        }
        const expected =
          input.expected === undefined
            ? undefined
            : parseNoteEntryChange({ type: 'replace', items: input.expected })
        options?.signal?.throwIfAborted()
        complete(
          await call(
            'editNoteEntries',
            id,
            change,
            expected?.type === 'replace' ? expected.items : undefined,
          ),
        )
      },
      async reorder(scope, input, options) {
        options?.signal?.throwIfAborted()
        complete(await call('orderNoteEntries', orderScope(scope), parseReorderInput(input)))
      },
      async move(scope, input, options) {
        options?.signal?.throwIfAborted()
        complete(await call('orderNoteEntries', orderScope(scope), parseMoveInput(input)))
      },
    },
  }
}
