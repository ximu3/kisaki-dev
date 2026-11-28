import { sql, type SQL } from 'drizzle-orm'
import type { EntrySort } from '@kisaki3/desktop-contracts/library'
import { partCount, scalar } from './fields'

export const nameOrder = sql`e.effective_sort_name collate kisaki_name, e.id`

export function orderBy(sort: EntrySort, scope: SQL = nameOrder): SQL {
  if (sort.type === 'scope') {
    return scope
  }
  const direction = sort.direction === 'asc' ? sql`asc` : sql`desc`
  if (sort.type === 'parts') {
    return sql`${partCount(sort.scope, sort.measure)} ${direction}, ${nameOrder}`
  }
  const value = scalar(sort.field)
  if (['name', 'effectiveSortName', 'originalName', 'cupSize'].includes(sort.field)) {
    return sql`${value} collate kisaki_name ${direction} nulls last, ${nameOrder}`
  }
  if (sort.field.endsWith('Date') || sort.field === 'birthMonthDay') {
    const components = sort.field === 'birthMonthDay' ? ['month', 'day'] : ['year', 'month', 'day']
    const terms = components.map(
      (key) => sql`json_extract(${value},${'$.' + key}) ${direction} nulls last`,
    )
    return sql`(${value} is null), ${sql.join(terms, sql`, `)}, ${nameOrder}`
  }
  if (['age', 'height', 'weight', 'bust', 'waist', 'hips'].includes(sort.field)) {
    return sql`case json_extract(${value},'$.kind') when 'number' then 0 when 'text' then 1 else 2 end, case when json_extract(${value},'$.kind')='number' then json_extract(${value},'$.value') end ${direction}, ${nameOrder}`
  }
  return sql`${value} ${direction} nulls last, ${nameOrder}`
}
