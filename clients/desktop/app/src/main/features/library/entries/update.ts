import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseEntryUpdate,
  parseEntryUpdates,
  type EntryUpdate,
} from '@kisaki3/desktop-contracts/library'
import type { CallOptions } from '@kisaki3/desktop-contracts/operations'
import type { createAttachments } from '../../../infrastructure/attachments'
import { imageIds, prepareImages } from '../attachments'
import type { CompleteWrite } from '../transaction'
import type { EntryCall } from './storage'

export function entryUpdates(
  call: EntryCall,
  attachments: ReturnType<typeof createAttachments>,
  complete: CompleteWrite,
) {
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
  return {
    update,
    updateMany: (batch: unknown, options?: CallOptions) => save(parseEntryUpdates(batch), options),
  }
}
