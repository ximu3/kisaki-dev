import {
  parseEntryCreate,
  type EntryCreate,
  type EntryRef,
} from '@kisaki3/desktop-contracts/library'
import type { CallOptions } from '@kisaki3/desktop-contracts/operations'
import type { createAttachments } from '../../../infrastructure/attachments'
import { imageIds, prepareImages } from '../attachments'
import type { CompleteWrite } from '../transaction'
import type { EntryCall } from './storage'

export function entryCreation(
  call: EntryCall,
  attachments: ReturnType<typeof createAttachments>,
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
  return create
}
