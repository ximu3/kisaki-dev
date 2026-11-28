import { parseEntryRef, parseExternalIdentity } from '@kisaki3/desktop-contracts/library'
import type { CallOptions } from '@kisaki3/desktop-contracts/operations'
import type { createAttachments } from '../../../infrastructure/attachments'
import type { DatabaseCall } from '../../../infrastructure/database/executor'
import type { CompleteWrite } from '../transaction'
import { entryCreation } from './create'
import { personalActions } from './personal'
import { entryQueries } from './query'
import type { EntryCall, entryStorage } from './storage'
import { entryUpdates } from './update'

export function createEntries(
  call: DatabaseCall<ReturnType<typeof entryStorage>>,
  attachments: ReturnType<typeof createAttachments>,
  view: () => { sensitive: boolean; spoilers: boolean },
  complete: CompleteWrite,
) {
  const updates = entryUpdates(call, attachments, complete)
  return {
    create: entryCreation(call, attachments, complete),
    ...updates,
    ...personalActions(updates.update),
    ...entryQueries(call, view),
    ...externalBindings(call, view, complete),
  }
}

function externalBindings(
  call: EntryCall,
  view: () => { sensitive: boolean },
  complete: CompleteWrite,
) {
  async function binding(target: unknown, id: unknown, bind: boolean, options?: CallOptions) {
    options?.signal?.throwIfAborted()
    complete(
      await call('changeEntryBinding', parseEntryRef(target), parseExternalIdentity(id), bind),
    )
  }
  return {
    findByExternalIdentity: (identity: unknown) =>
      call('findLibraryIdentity', parseExternalIdentity(identity), view().sensitive),
    bindExternalIdentity: (target: unknown, id: unknown, options?: CallOptions) =>
      binding(target, id, true, options),
    unbindExternalIdentity: (target: unknown, id: unknown, options?: CallOptions) =>
      binding(target, id, false, options),
  }
}
