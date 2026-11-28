import { eq, sql } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  EntryQuery,
  QueryReferenceLabel,
  EntryRule,
  EntryScope,
} from '@kisaki3/desktop-contracts/library'
import { entries, collections, tags, notes } from '../../../../infrastructure/database/schema'
import type { LibraryDatabase } from '../../transaction'

type Target = QueryReferenceLabel['target']
interface Reference {
  target: Target
  required: boolean
  manual: boolean
}
function queryRefs(scope: EntryScope, rules: readonly EntryRule[]) {
  const refs = new Map<string, Reference>()
  function add(target: Target, required: boolean, manual = false) {
    const key = JSON.stringify([target.type, target.id])
    const before = refs.get(key)
    refs.set(key, {
      target,
      required: required || !!before?.required,
      manual: manual || !!before?.manual,
    })
  }
  if ('id' in scope) {
    add({ type: scope.type, id: scope.id }, true)
  }
  for (const rule of rules) {
    for (const condition of rule.filter.conditions) {
      if (
        (condition.field === 'tags' || condition.field === 'manualCollections') &&
        'values' in condition
      ) {
        for (const id of condition.values) {
          add(
            { type: condition.field === 'tags' ? 'tag' : 'collection', id },
            rule.enabled,
            condition.field === 'manualCollections',
          )
        }
      }
      if (!('targets' in condition)) {
        continue
      }
      if ('values' in condition.targets) {
        for (const ref of condition.targets.values) {
          add(ref, rule.enabled)
        }
      }
      const where = condition.where
      if (where && 'works' in where) {
        for (const ref of where.works ?? []) {
          add(ref, rule.enabled)
        }
      }
      if (
        condition.field === 'workPersons' ||
        condition.field === 'workCharacterPersons' ||
        condition.field === 'personWorks'
      ) {
        const character = condition.where?.character
        if (character?.type === 'oneOf') {
          for (const ref of character.refs) {
            add(ref, rule.enabled)
          }
        }
      }
    }
  }
  return [...refs.values()]
}

function resolveReference(db: LibraryDatabase, { target, manual }: Reference, sensitive: boolean) {
  if (target.type === 'note') {
    return db.select({ name: notes.title }).from(notes).where(eq(notes.id, target.id)).get()
  }
  if (target.type === 'collection') {
    const row = db
      .select({
        mode: collections.membershipMode,
        name: sql<
          string | null
        >`case when ${Number(sensitive)} or not ${collections.isNsfw} then ${collections.name} end`,
      })
      .from(collections)
      .where(eq(collections.id, target.id))
      .get()
    return row && (!manual || row.mode === 'manual') ? row : undefined
  }
  if (target.type === 'tag') {
    return db
      .select({
        name: sql<
          string | null
        >`case when ${Number(sensitive)} or not ${tags.isNsfw} then ${tags.name} end`,
      })
      .from(tags)
      .where(eq(tags.id, target.id))
      .get()
  }
  const row = db
    .select({
      type: entries.type,
      name: sql<
        string | null
      >`case when ${Number(sensitive)} or not ${entries.isNsfw} then ${entries.name} end`,
    })
    .from(entries)
    .where(eq(entries.id, target.id))
    .get()
  return row?.type === target.type ? row : undefined
}

export function queryReferences(
  db: LibraryDatabase,
  query: Pick<EntryQuery, 'rules' | 'scope'>,
  sensitive: boolean,
  previous?: readonly QueryReferenceLabel[],
) {
  const labels: QueryReferenceLabel[] = []
  for (const ref of queryRefs(query.scope, query.rules)) {
    if (!ref.required && !previous) {
      continue
    }
    const saved = resolveReference(db, ref, sensitive)
    if (!saved && ref.required) {
      throw new DesktopError(
        'InvalidReference',
        'A referenced library item no longer exists in the required scope',
      )
    }
    if (previous) {
      const name =
        saved?.name ??
        previous.find(
          (row) => row.target.type === ref.target.type && row.target.id === ref.target.id,
        )?.name
      if (name) {
        labels.push({ target: ref.target, name })
      }
    }
  }
  return labels
}
