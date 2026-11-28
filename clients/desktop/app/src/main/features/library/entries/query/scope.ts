import { eq, sql, type SQL } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { EntryQuery, EntryGroupKey, EntryScope } from '@kisaki3/desktop-contracts/library'
import { collections } from '../../../../infrastructure/database/schema'
import type { LibraryDatabase } from '../../transaction'
import type { Visibility } from './relations'
import { rulePredicate } from './conditions'
import { orderBy, nameOrder } from './order'
import { queryReferences } from './references'

export function groupCollections(db: LibraryDatabase, view: Visibility) {
  return db
    .select({
      id: collections.id,
      membershipMode: collections.membershipMode,
      dynamicRules: collections.dynamicRules,
    })
    .from(collections)
    .where(view.sensitive ? undefined : eq(collections.isNsfw, false))
    .orderBy(collections.sortOrder, collections.id)
    .all()
}

type Collection = ReturnType<typeof groupCollections>[number]
function collectionScope(db: LibraryDatabase, row: Collection, view: Visibility) {
  if (row.membershipMode === 'manual') {
    return {
      filter: sql`e.id in (select entry_id from collection_members where collection_id=${row.id})`,
      order: sql`(select order_in_collection from collection_members where collection_id=${row.id} and entry_id=e.id),e.id`,
    }
  }
  if (row.dynamicRules?.status !== 'ready') {
    throw new DesktopError('InvalidQuery', 'The dynamic collection rules cannot be read')
  }
  const rule = row.dynamicRules.value
  queryReferences(db, { scope: { type: 'library' }, rules: rule.rules }, view.sensitive)
  return { filter: rulePredicate(rule.rules, rule.search, view), order: orderBy(rule.sort) }
}

export function makeQuery(db: LibraryDatabase, input: EntryQuery, view: Visibility) {
  queryReferences(db, input, view.sensitive)
  const rows = groupCollections(db, view)
  const prepared = new Map<string, ReturnType<typeof collectionScope>>()
  function group(row: Collection) {
    let found = prepared.get(row.id)
    if (!found) {
      found = collectionScope(db, row, view)
      prepared.set(row.id, found)
    }
    return found
  }

  function constraint(scope: EntryScope | EntryGroupKey): { filter: SQL; order: SQL } {
    switch (scope.type) {
      case 'library':
        return { filter: sql`1`, order: nameOrder }
      case 'favorites':
        return {
          filter: sql`e.id in (select entry_id from entry_evaluations where favorite=1)`,
          order: nameOrder,
        }
      case 'tag':
        return {
          filter: sql`e.id in (select l.entry_id from entry_tags l join tags t on t.id=l.tag_id where l.tag_id=${scope.id} ${view.sensitive ? sql.empty() : sql`and not t.is_nsfw`} ${view.spoilers ? sql.empty() : sql`and not l.is_spoiler`})`,
          order: sql`(select order_in_tag from entry_tags where tag_id=${scope.id} and entry_id=e.id),e.id`,
        }
      case 'note':
        return {
          filter: sql`e.id in (select entry_id from note_entry_links where note_id=${scope.id})`,
          order: sql`(select order_in_note from note_entry_links where note_id=${scope.id} and entry_id=e.id),e.id`,
        }
      case 'collection': {
        const row = rows.find((row) => row.id === scope.id)
        if (row) {
          return group(row)
        }
        if (
          !db
            .select({ id: collections.id })
            .from(collections)
            .where(eq(collections.id, scope.id))
            .get()
        ) {
          throw new DesktopError('InvalidReference', 'The collection no longer exists')
        }
        return { filter: sql`0`, order: nameOrder }
      }
      case 'unclassified': {
        const members = [
          sql`select m.entry_id from collection_members m join collections c on c.id=m.collection_id ${view.sensitive ? sql.empty() : sql`where not c.is_nsfw`}`,
        ]
        for (const row of rows) {
          if (row.membershipMode === 'dynamic') {
            members.push(sql`select e.id from entries e where ${group(row).filter}`)
          }
        }
        return {
          filter: sql`e.id not in (${sql.join(members, sql` union all `)})`,
          order: nameOrder,
        }
      }
    }
  }

  const fixed = constraint(input.scope)
  const common = rulePredicate(input.rules, input.search, view)
  function resolve(key?: EntryGroupKey) {
    const inside = key ? constraint(key) : fixed
    const where = key
      ? sql`(${fixed.filter}) and (${inside.filter}) and (${common})`
      : sql`(${fixed.filter}) and (${common})`
    return { where, order: orderBy(input.sort, inside.order) }
  }
  const groups: EntryGroupKey[] = [
    ...rows.map((row) => ({ type: 'collection' as const, id: row.id })),
    { type: 'unclassified' },
  ]
  return { resolve, groups }
}
