import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseEntryListOptions,
  parseEntryLocateOptions,
  parseEntryQuery,
  parseEntryRef,
  parseEntrySelection,
  type EntryDetails,
  type EntryRef,
  type EntryType,
} from '@kisaki3/desktop-contracts/library'
import type { EntryViewTarget } from '@kisaki3/desktop-contracts/ui'
import type { EntryCall } from '../storage'

export function entryQueries(
  call: EntryCall,
  view: () => { sensitive: boolean; spoilers: boolean },
) {
  return {
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
  }
}
