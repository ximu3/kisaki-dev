/** @fileoverview Reads stable pages, counts and positions from a distinct set of eligible entry IDs. */

/** SQL returning unique IDs and an optional indexed membership probe for a name-ordered scan. */
export interface EntrySelection {
  ids: string
  /** Equivalent predicate on the current entries row e, for link sets with multiple hits per entry. */
  probe?: string
}

/**
 * Reads a page in the library's name and ID order. For an offset page the live count and both
 * traversal bounds belong to one SQLite statement. Only the nearer end supplies rows.
 */
export function pageStatement({ ids, probe }: EntrySelection, offset: number): string {
  if (offset === 0) {
    return `select e.id from entries e where ${probe ?? `e.id in (${ids})`}
      order by e.effective_sort_name, e.id limit ? offset ?`
  }

  const members = probe ? '' : `members(id) as materialized (${ids}),`
  const count = `select count(*) from ${probe ? `(${ids})` : 'members'}`
  const matches = probe ?? 'e.id in members'

  /** Walks the ordering index only for the direction selected by the actual page bounds. */
  function scan(order: 'asc' | 'desc', condition: string, skip: 'head' | 'tail') {
    return `select e.id, e.effective_sort_name as name from entries e indexed by entries_sort
      where ${matches} order by e.effective_sort_name ${order}, e.id ${order}
      limit (select case when ${condition} then length else 0 end from bounds)
      offset (select ${skip} from bounds)`
  }

  return `with ${members}
    bounds as materialized (
      select head, max(0, total - head - size) as tail, max(0, min(size, total - head)) as length
      from (select (${count}) as total), (select ? as size, ? as head)
    ),
    forward as (${scan('asc', 'head <= tail', 'head')}),
    backward as (${scan('desc', 'tail < head', 'tail')})
    select id from (select * from forward union all select * from backward) order by name, id`
}

/** Counts strict predecessors of the supplied name and ID using the same eligible entries. */
export function positionStatement({ ids, probe }: EntrySelection): string {
  if (!probe) {
    return `select count(*) as position from (${ids}) m join entries e on e.id = m.id
      where (e.effective_sort_name, e.id) < (?, ?)`
  }

  // Seek directly below the name and scan back to the start. The equal-name range uses the ID tie-break.
  return `with anchor(name, id) as (values (?, ?))
    select (select count(*) from (
      select 1 from entries e indexed by entries_sort
      where e.effective_sort_name < (select name from anchor) and ${probe}
      order by e.effective_sort_name desc, e.id desc
    )) + (select count(*) from entries e indexed by entries_sort
      where e.effective_sort_name = (select name from anchor)
        and e.id < (select id from anchor) and ${probe}) as position`
}
