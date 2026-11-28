import type { createAttachments } from '../../../infrastructure/attachments'
import type { CompleteWrite } from '../transaction'
import { createCollections } from './collections'
import { createTags } from './tags'
import { organizerWrites, type OrganizerCall } from './write'

export function createOrganizers(
  call: OrganizerCall,
  attachments: ReturnType<typeof createAttachments>,
  sensitive: () => boolean,
  complete: CompleteWrite,
) {
  const writes = organizerWrites(call, attachments, complete)
  return {
    collections: createCollections(call, writes, sensitive, complete),
    tags: createTags(call, writes, sensitive, complete),
  }
}
