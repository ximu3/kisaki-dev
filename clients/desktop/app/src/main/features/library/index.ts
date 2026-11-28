import type { LibraryApi, HoldingsApi } from '@kisaki3/desktop-contracts/library'
import type { PreferencesSnapshot } from '@kisaki3/desktop-contracts/preferences'
import type { Translate } from '@kisaki3/desktop-localization'
import type { NativeEventPublisher } from '@kisaki3/desktop-contracts/events'
import type { createAttachments } from '../../infrastructure/attachments'
import type { DatabaseCall } from '../../infrastructure/database/executor'
import { createAnnotations } from './records/annotations'
import { createNotes } from './records/notes'
import { createGraphWriter } from './graph'
import { createEntries } from './entries'
import { createCompletions } from './records/completions'
import { createShowcase } from './showcase'
import { createOrganizers } from './organizers'
import { createRelations } from './relations'
import { createParts } from './parts'
import { createActivities } from './records/activities'
import { createHoldings } from './holdings'
import type { NativeFiles } from '#native'
import type { ChangeAdmission } from '../../infrastructure/use-targets'
import type { libraryStorage } from './storage'
import type { LibraryCommit } from './transaction'

import { libraryInvalidation } from './invalidation'
import { identityOperations } from './entries/identity'

export function createLibrary(
  call: DatabaseCall<ReturnType<typeof libraryStorage>>,
  attachments: ReturnType<typeof createAttachments>,
  facts: NativeEventPublisher<'library.changed'>,
  sensitive: () => boolean,
  language: () => { locale: string; t: Translate },
  native: NativeFiles,
  resources: string,
  worker: URL,
  admit: ChangeAdmission,
  usage: () => PreferencesSnapshot['usage'],
) {
  const invalidation = libraryInvalidation()
  function complete<T>(result: LibraryCommit<T>) {
    const [first, ...others] = result.changes
    if (first) {
      facts.emit({ changes: [first, ...others], committedAt: result.committedAt })
      invalidation.commit(result.changes)
    }
    if (result.released.length) {
      attachments.retire(result.released)
    }
    return result.value
  }

  const holdings = createHoldings(
    call,
    complete,
    native,
    resources,
    worker,
    admit,
    sensitive,
    () => language().t,
    usage,
    invalidation.holdings,
  )
  const library = {
    onInvalidated: invalidation.on,
    visibilityChanged: invalidation.all,
    ...identityOperations(call, native, resources, admit, complete),
    annotations: createAnnotations(call, attachments, complete, sensitive),
    notes: createNotes(call, attachments, complete, sensitive),
    writeGraph: createGraphWriter(
      call,
      attachments,
      native,
      resources,
      complete,
      holdings.locationsChanged,
    ),
    entries: createEntries(
      call,
      attachments,
      () => ({ sensitive: sensitive(), spoilers: false }),
      complete,
    ),
    completions: createCompletions(call, sensitive, complete),
    showcase: createShowcase(call, complete, sensitive, language),
    ...createOrganizers(call, attachments, sensitive, complete),
    relations: createRelations(call, sensitive, complete),
    parts: createParts(call, attachments, complete, sensitive, admit),
    activities: createActivities(call, complete, sensitive, admit),
    holdings,
  }
  return library satisfies Omit<LibraryApi, 'holdings'> & { holdings: Omit<HoldingsApi, 'backups'> }
}
