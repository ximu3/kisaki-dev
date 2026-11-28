import {
  parseAnnotationCreate,
  parseWorkRef,
  parseCompletionCreateMany,
  parseAnnotationQuery,
  parseAnnotationRef,
  parseAnnotationUpdate,
  parseNoteCreate,
  parseNoteQuery,
  parseNoteUpdate,
  type NoteOrderScope,
  parseReorderInput,
  type AnnotationsApi,
} from '@kisaki3/desktop-contracts/library'
import { parseListOptions } from '@kisaki3/desktop-contracts/operations'
import type { Application } from '../../../compose'
import { rpcData } from '../../../../../shared/window-api/protocol'
import { textArgument } from '../../values'
import { windowMethod } from '../../admission'

export function recordMethods(
  { notes, annotations, activities, completions }: Application['library'],
  prepared: (input: unknown, ids: unknown) => object,
) {
  return {
    'library.activities.list': windowMethod('read', async ([raw, range]) =>
      rpcData(await activities.list(raw, range)),
    ),
    'library.activities.get': windowMethod('read', async ([work, id]) =>
      rpcData(await activities.get(parseWorkRef(work), textArgument(id))),
    ),
    'library.activities.statistics': windowMethod('read', async ([raw]) =>
      rpcData(await activities.statistics(raw)),
    ),
    'library.activities.create': windowMethod('write', ([raw], signal) =>
      activities.create(raw, { signal }),
    ),
    'library.activities.update': windowMethod('write', ([work, id, input], signal) =>
      activities.update(work, textArgument(id), input, { signal }),
    ),
    'library.activities.delete': windowMethod('write', ([work, ids], signal) =>
      activities.delete(work, ids, { signal }),
    ),
    'library.completions.statistics': windowMethod('read', async ([raw]) =>
      rpcData(await completions.statistics(raw)),
    ),
    'library.completions.list': windowMethod('read', async ([work, range]) =>
      rpcData(await completions.list(parseWorkRef(work), range)),
    ),
    'library.completions.get': windowMethod('read', async ([work, id]) =>
      rpcData(await completions.get(parseWorkRef(work), textArgument(id))),
    ),
    'library.completions.create': windowMethod('write', ([work, input], signal) =>
      completions.create(work, input, { signal }),
    ),
    'library.completions.recordCurrent': windowMethod('write', ([work, input], signal) =>
      completions.recordCurrent(work, input, { signal }),
    ),
    'library.completions.recordCurrentMany': windowMethod('write', async ([input], signal) =>
      rpcData(await completions.recordCurrentMany(parseCompletionCreateMany(input), { signal })),
    ),
    'library.completions.createMany': windowMethod('write', async ([input], signal) =>
      rpcData(await completions.createMany(input, { signal })),
    ),
    'library.completions.update': windowMethod('write', ([work, id, input], signal) =>
      completions.update(work, textArgument(id), input, { signal }),
    ),
    'library.completions.delete': windowMethod('write', ([work, id], signal) =>
      completions.delete(work, textArgument(id), { signal }),
    ),
    'library.notes.list': windowMethod('read', async ([query, range], signal) =>
      rpcData(await notes.list(parseNoteQuery(query), parseListOptions(range), { signal })),
    ),
    'library.notes.get': windowMethod('read', async ([id], signal) =>
      rpcData(await notes.get(textArgument(id), { signal })),
    ),
    'library.notes.entries': windowMethod('read', async ([id, range], signal) =>
      rpcData(await notes.entries.list(textArgument(id), parseListOptions(range), { signal })),
    ),
    'library.notes.create': windowMethod('write', ([fields, ids], signal) =>
      notes.create(parseNoteCreate(prepared(fields, ids)), { signal }),
    ),
    'library.notes.update': windowMethod('write', ([id, input, ids], signal) =>
      notes.update(textArgument(id), parseNoteUpdate(prepared(input, ids)), { signal }),
    ),
    'library.notes.delete': windowMethod('write', ([id], signal) =>
      notes.delete(textArgument(id), { signal }),
    ),
    'library.notes.reorder': windowMethod('write', ([scope, input], signal) =>
      notes.entries.reorder(scope as NoteOrderScope, parseReorderInput(input), { signal }),
    ),
    'library.annotations.list': windowMethod('read', async ([query, range], signal) =>
      rpcData(
        await annotations.list(parseAnnotationQuery(query), parseListOptions(range), { signal }),
      ),
    ),
    'library.annotations.get': windowMethod('read', async ([raw], signal) =>
      rpcData(await annotations.get(parseAnnotationRef(raw), { signal })),
    ),
    'library.annotations.create': windowMethod('write', ([input, ids], signal) =>
      annotations.create(parseAnnotationCreate(prepared(input, ids)), { signal }),
    ),
    'library.annotations.update': windowMethod('write', ([raw, input, ids], signal) => {
      const ref = parseAnnotationRef(raw)
      return annotations.update(
        ...([ref, parseAnnotationUpdate(ref, prepared(input, ids)), { signal }] as Parameters<
          AnnotationsApi['update']
        >),
      )
    }),
    'library.annotations.delete': windowMethod('write', ([raw], signal) =>
      annotations.delete(parseAnnotationRef(raw), { signal }),
    ),
  }
}
