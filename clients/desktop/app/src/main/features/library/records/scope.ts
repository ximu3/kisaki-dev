import * as v from 'valibot'
import { sql } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseWorkRef,
  workTypes,
  type WorkStatisticsScope,
} from '@kisaki3/desktop-contracts/library'
import type { LibraryDatabase } from '../transaction'
import { requireEntry } from '../entries/tables'

export function statisticsScope(input: unknown): WorkStatisticsScope {
  const parsed = v.safeParse(
    v.variant('type', [
      v.strictObject({
        type: v.literal('library'),
        workTypes: v.exactOptional(v.array(v.picklist(workTypes))),
      }),
      v.strictObject({ type: v.literal('works'), refs: v.array(v.unknown()) }),
    ]),
    input,
  )
  if (!parsed.success) {
    throw new DesktopError('InvalidInput', 'Invalid statistics scope')
  }
  if (parsed.output.type === 'library') {
    return parsed.output
  }
  const refs = parsed.output.refs.map(parseWorkRef)
  return {
    type: 'works',
    refs: [...new Map(refs.map((ref) => [JSON.stringify([ref.type, ref.id]), ref])).values()],
  }
}
export function workSet(db: LibraryDatabase, scope: WorkStatisticsScope, sensitive: boolean) {
  const visible = sensitive ? sql.empty() : sql`and not is_nsfw`
  if (scope.type === 'works') {
    for (const ref of scope.refs) {
      requireEntry(db, ref)
    }
    return sql`select id,type from entries where id in (select value from json_each(${JSON.stringify(scope.refs.map((r) => r.id))})) ${visible}`
  }
  return sql`select id,type from entries where type in (select value from json_each(${JSON.stringify(scope.workTypes ?? workTypes)})) ${visible}`
}
