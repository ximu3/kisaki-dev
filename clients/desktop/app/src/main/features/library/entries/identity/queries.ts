import { eq } from 'drizzle-orm'
import {
  parseDynamicRules,
  parseShowcaseQuery,
  type QueryReferenceLabel,
} from '@kisaki3/desktop-contracts/library'
import { collections, showcaseSections } from '../../../../infrastructure/database/schema'
import { ready } from '../../../../infrastructure/database/codecs/json'
import type { LibraryWrite } from '../../transaction'

type Target = QueryReferenceLabel['target']
export function redirectQueries(write: LibraryWrite, from: Target, to: Target, name: string) {
  function replace(input: unknown, field?: string): unknown {
    if (Array.isArray(input)) {
      const values = input.map((item) => replace(item))
      if (!values.some((value, i) => value !== input[i])) {
        return input
      }
      if (
        field !== 'values' &&
        field !== 'refs' &&
        field !== 'works' &&
        field !== 'referenceLabels'
      ) {
        return values
      }
      const seen = new Set<string>()
      return values.filter((value) => {
        const key = JSON.stringify(
          field === 'referenceLabels' ? (value as QueryReferenceLabel).target : value,
        )
        if (seen.has(key)) {
          return false
        }
        seen.add(key)
        return true
      })
    }
    if (!input || typeof input !== 'object') {
      return input
    }
    const row = input as Record<string, unknown>
    if (row.type === from.type && row.id === from.id) {
      return { ...row, id: to.id }
    }
    if (
      row.target &&
      typeof row.target === 'object' &&
      'id' in row.target &&
      row.target.id === from.id &&
      'type' in row.target &&
      row.target.type === from.type
    ) {
      return { target: to, name }
    }
    const next: Record<string, unknown> = {}
    let changed = false
    for (const [key, value] of Object.entries(row)) {
      const organizerValues =
        key === 'values' &&
        Array.isArray(value) &&
        ((row.field === 'tags' && from.type === 'tag') ||
          (row.field === 'manualCollections' && from.type === 'collection'))
      const updated =
        organizerValues && value.includes(from.id)
          ? [...new Set((value as string[]).map((id) => (id === from.id ? to.id : id)))]
          : replace(value, key)
      next[key] = updated
      changed ||= updated !== value
    }
    return changed ? next : input
  }
  const { db } = write
  for (const row of db
    .select({ id: showcaseSections.id, query: showcaseSections.query })
    .from(showcaseSections)
    .all()) {
    if (row.query.status !== 'ready') {
      continue
    }
    const next = replace(row.query.value)
    if (next === row.query.value) {
      continue
    }
    db.update(showcaseSections)
      .set({ query: ready(parseShowcaseQuery(next)), updatedAt: write.now })
      .where(eq(showcaseSections.id, row.id))
      .run()
    write.changes.push({ type: 'showcaseChanged', sectionIds: [row.id] })
  }
  for (const row of db
    .select({ id: collections.id, rules: collections.dynamicRules })
    .from(collections)
    .where(eq(collections.membershipMode, 'dynamic'))
    .all()) {
    if (row.rules?.status !== 'ready') {
      continue
    }
    const next = replace(row.rules.value)
    if (next === row.rules.value) {
      continue
    }
    db.update(collections)
      .set({ dynamicRules: ready(parseDynamicRules(next)), updatedAt: write.now })
      .where(eq(collections.id, row.id))
      .run()
    write.changes.push({ type: 'collectionUpdated', collectionId: row.id })
  }
}
