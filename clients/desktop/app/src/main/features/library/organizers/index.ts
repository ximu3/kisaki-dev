import type { createAttachments } from '../../../infrastructure/attachments'
import type { CompleteWrite } from '../transaction'
import { createCollections } from './collections'
import { createTags } from './tags'
import { memberships } from './members'
import { organizerWrites, type OrganizerCall } from './writes'

export function createOrganizers(
  call: OrganizerCall,
  attachments: ReturnType<typeof createAttachments>,
  sensitive: () => boolean,
  complete: CompleteWrite,
) {
  const writes = organizerWrites(call, attachments, complete)
  const { members, entries } = memberships(call, complete, sensitive)
  return {
    collections: createCollections(call, writes, sensitive, complete, members),
    tags: createTags(call, writes, sensitive, entries),
  }
}
