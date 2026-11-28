import {
  entryTypes,
  workTypes,
  type EntryScope,
  type EntryQuery,
  type EntryRule,
  type EntryType,
} from '@kisaki3/desktop-contracts/library'

export function browseQuery(
  scope: EntryScope,
  types: EntryRule['types'] = scope.type === 'library' || scope.type === 'unclassified'
    ? workTypes
    : entryTypes,
): EntryQuery {
  return {
    scope,
    search: '',
    rules: [{ enabled: true, types, filter: { match: 'all', conditions: [] } }],
    sort: { type: 'scope' },
  }
}

export function selectedTypes(query: EntryQuery): ReadonlySet<EntryType> {
  return new Set(query.rules.filter((rule) => rule.enabled).flatMap((rule) => rule.types))
}
