import type { Attachment } from '@kisaki3/desktop-contracts/attachments'
import { parseOrganizerMerge } from '@kisaki3/desktop-contracts/library'
import type { CallOptions } from '@kisaki3/desktop-contracts/operations'
import type { PreparedAttachment } from '@kisaki3/desktop-contracts/resources'
import type { createAttachments } from '../../../infrastructure/attachments'
import type { DatabaseCall } from '../../../infrastructure/database/executor'
import { imageIds, prepareImages } from '../attachments'
import type { CompleteWrite, LibraryCommit } from '../transaction'
import type { organizerStorage } from './storage'
import type { Organizer } from './members/storage'

export type OrganizerCall = DatabaseCall<ReturnType<typeof organizerStorage>>
export type OrganizerWrites = ReturnType<typeof organizerWrites>

export function organizerWrites(
  call: OrganizerCall,
  attachments: ReturnType<typeof createAttachments>,
  complete: CompleteWrite,
) {
  async function save<T>(
    fields: object,
    prepared: readonly PreparedAttachment[] | undefined,
    options: CallOptions | undefined,
    persist: (images: readonly Attachment[]) => Promise<LibraryCommit<T>>,
  ) {
    options?.signal?.throwIfAborted()
    const hold = await prepareImages(attachments, imageIds(fields), prepared ?? [])
    try {
      options?.signal?.throwIfAborted()
      return complete(await persist(hold.records))
    } finally {
      await hold.dispose()
    }
  }

  async function remove(kind: Organizer, id: string, options?: CallOptions) {
    options?.signal?.throwIfAborted()
    complete(await call('deleteOrganizer', kind, id))
  }
  async function merge(kind: Organizer, input: unknown, options?: CallOptions) {
    options?.signal?.throwIfAborted()
    return complete(await call('mergeOrganizers', kind, parseOrganizerMerge(input)))
  }
  return { save, remove, merge }
}
