import type { EntryViewTarget } from '@kisaki3/desktop-contracts/ui'
import {
  parseEntryCreate,
  parseEntryRef,
  parseEntryUpdate,
  parseEntryUpdates,
  parseEntryQuery,
  parseEntryListOptions,
  parseEntryLocateOptions,
  parseEntrySelection,
  parseExternalIdentity,
  parseEvaluationUpdate,
  parseWorkRef,
  parseWorkStatusUpdate,
  type EntryUpdate,
  type EntryCreate,
  type EntryType,
  type EntryRef,
  type EntryDetails,
} from '@kisaki3/desktop-contracts/library'
import type { CallOptions } from '@kisaki3/desktop-contracts/operations'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { DatabaseCall } from '../../../infrastructure/database/executor'
import type { createAttachments } from '../../../infrastructure/attachments'
import { imageIds, prepareImages } from '../attachments'
import type { CompleteWrite } from '../transaction'
import type { entryStorage } from './storage'

export function createEntries(
  call: DatabaseCall<ReturnType<typeof entryStorage>>,
  attachments: ReturnType<typeof createAttachments>,
  view: () => { sensitive: boolean; spoilers: boolean },
  complete: CompleteWrite,
) {
  async function create<I extends EntryCreate>(
    raw: I,
    options?: CallOptions,
  ): Promise<EntryRef<I['type']>> {
    const { prepared = [], ...value } = parseEntryCreate(raw)
    options?.signal?.throwIfAborted()
    const hold = await prepareImages(attachments, imageIds(value), prepared)
    try {
      options?.signal?.throwIfAborted()
      return complete(await call('createLibraryEntry', value, hold.records)) as EntryRef<I['type']>
    } finally {
      await hold.dispose()
    }
  }

  async function save(batch: readonly EntryUpdate[], options?: CallOptions) {
    options?.signal?.throwIfAborted()
    const ids = batch.flatMap((row) => imageIds(row.changes))
    const hold = await prepareImages(
      attachments,
      ids,
      batch.flatMap((row) => row.prepared ?? []),
    )
    try {
      options?.signal?.throwIfAborted()
      complete(
        await call(
          'editLibraryEntries',
          batch.map(({ prepared: _resources, ...edit }) => edit),
          hold.records,
        ),
      )
    } finally {
      await hold.dispose()
    }
  }

  function update(target: unknown, raw: unknown, options?: CallOptions) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || 'ref' in raw) {
      throw new DesktopError('InvalidInput', 'Invalid entry update')
    }
    return save([parseEntryUpdate({ ...raw, ref: target })], options)
  }

  async function binding(target: unknown, id: unknown, bind: boolean, options?: CallOptions) {
    options?.signal?.throwIfAborted()
    complete(
      await call('changeEntryBinding', parseEntryRef(target), parseExternalIdentity(id), bind),
    )
  }

  return {
    create,
    update,
    updateMany: (batch: unknown, options?: CallOptions) => save(parseEntryUpdates(batch), options),
    locateTarget: (input: EntryViewTarget) => call('locateViewTarget', input, view().sensitive),
    organizers: (raw: unknown, spoilers: boolean) =>
      call('readEntryOrganizers', parseEntryRef(raw), view().sensitive, spoilers),
    resolveRefs(input: unknown) {
      if (!Array.isArray(input) || input.length > 200) {
        throw new DesktopError('InvalidInput', 'Choose at most 200 entries per interval')
      }
      return call('resolveLibraryRefs', input.map(parseEntryRef), view().sensitive)
    },
    get: <T extends EntryType>(target: EntryRef<T>) =>
      call(
        'readLibraryEntry',
        parseEntryRef(target),
        view().sensitive,
      ) as Promise<EntryDetails<T> | null>,
    getDescription: (target: unknown) =>
      call('readEntryDescription', parseEntryRef(target), view().sensitive),
    findByExternalIdentity: (identity: unknown) =>
      call('findLibraryIdentity', parseExternalIdentity(identity), view().sensitive),
    bindExternalIdentity: (target: unknown, id: unknown, options?: CallOptions) =>
      binding(target, id, true, options),
    unbindExternalIdentity: (target: unknown, id: unknown, options?: CallOptions) =>
      binding(target, id, false, options),
    list(raw: unknown, options: unknown) {
      const query = parseEntryQuery(raw)
      return call('readEntryInterval', query, parseEntryListOptions(options, query), view())
    },
    locate(raw: unknown, target: unknown, options: unknown) {
      const query = parseEntryQuery(raw)
      return call(
        'locateLibraryEntry',
        query,
        parseEntryRef(target),
        parseEntryLocateOptions(options, query),
        view(),
      )
    },
    groups(raw: unknown, grouping: unknown) {
      if (
        !grouping ||
        typeof grouping !== 'object' ||
        Object.keys(grouping).length !== 1 ||
        !('type' in grouping) ||
        grouping.type !== 'collections'
      ) {
        throw new DesktopError('InvalidInput', 'Choose collection grouping')
      }
      return call('readEntryGroups', parseEntryQuery(raw), view())
    },
    locateInGroups(raw: unknown, target: unknown, preferred: unknown) {
      const query = parseEntryQuery(raw)
      const options = parseEntryLocateOptions(
        { limit: 1, ...(preferred !== null && { group: preferred }) },
        query,
      )
      return call('locateExplorerRow', query, parseEntryRef(target), options.group, view())
    },
    selectRefs: (raw: unknown, selection: unknown) =>
      call('selectLibraryEntries', parseEntryQuery(raw), parseEntrySelection(selection), view()),
    setEvaluation(target: unknown, raw: unknown, options?: CallOptions) {
      const { changes, expected } = parseEvaluationUpdate(raw)
      return update(
        target,
        {
          changes: { evaluation: changes },
          ...(expected && { expected: { evaluation: expected } }),
        },
        options,
      )
    },
    setWorkStatus(target: unknown, raw: unknown, options?: CallOptions) {
      const { status, expected } = parseWorkStatusUpdate(raw)
      return update(
        parseWorkRef(target),
        { changes: { record: { status } }, ...(expected && { expected: { record: expected } }) },
        options,
      )
    },
  }
}
