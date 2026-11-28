import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { eq, max } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  ShowcaseFields,
  ShowcaseQuery,
  ShowcaseUpdate,
  ReorderInput,
  QueryReferenceLabel,
} from '@kisaki3/desktop-contracts/library'
import type { Storage } from '../../../infrastructure/database'
import { showcaseSections as sections } from '../../../infrastructure/database/schema'
import { ready } from '../../../infrastructure/database/codecs/json'
import { commit, expectFields, type LibraryDatabase } from '../transaction'
import { queryReferences } from '../entries/query/references'

function savedQuery(
  db: LibraryDatabase,
  query: ShowcaseQuery,
  sensitive: boolean,
  labels: readonly QueryReferenceLabel[] = [],
): ShowcaseQuery {
  if (query.kind !== 'entry') {
    return query
  }
  return { ...query, referenceLabels: queryReferences(db, query, sensitive, labels) }
}

export function showcaseStorage(storage: Storage) {
  const { db } = storage
  return {
    listShowcase: () => db.select().from(sections).orderBy(sections.sortOrder, sections.id).all(),
    getShowcase: (id: string) =>
      db.select().from(sections).where(eq(sections.id, id)).get() ?? null,

    addSections(fields: readonly ShowcaseFields[], sensitive: boolean) {
      return commit(storage, ({ db, changes, now }) => {
        const last =
          db
            .select({ order: max(sections.sortOrder) })
            .from(sections)
            .get()!.order ?? -1
        const saved = fields.map((input, i) =>
          db
            .insert(sections)
            .values({
              ...input,
              query: ready(savedQuery(db, input.query, sensitive)),
              id: randomUUID(),
              sortOrder: last + i + 1,
              createdAt: now,
              updatedAt: now,
            })
            .returning()
            .get(),
        )
        changes.push({ type: 'showcaseChanged', sectionIds: saved.map((row) => row.id) })
        return saved
      })
    },

    editSection(id: string, input: ShowcaseUpdate, sensitive: boolean) {
      return commit(storage, ({ db, changes, now }) => {
        const target = eq(sections.id, id)
        const row = db.select().from(sections).where(target).get()
        if (!row) {
          throw new DesktopError('NotFound', 'The showcase section does not exist')
        }
        const original = row.query.status === 'ready' ? row.query.value : undefined
        expectFields({ ...row, query: original }, input.expected)

        const { query, ...fields } = input.changes
        let next = query
        if (query || (fields.isVisible && !row.isVisible)) {
          const selected = query ?? original
          if (!selected) {
            throw new DesktopError('InvalidQuery', 'Repair the section query before showing it')
          }
          next = savedQuery(
            db,
            selected,
            sensitive,
            original?.kind === 'entry' ? original.referenceLabels : [],
          )
        }
        if (
          Object.entries(fields).every(([key, value]) =>
            isDeepStrictEqual(value, Reflect.get(row, key)),
          ) &&
          (!next || isDeepStrictEqual(next, original))
        ) {
          return row
        }
        const updated = db
          .update(sections)
          .set({ ...fields, ...(next && { query: ready(next) }), updatedAt: now })
          .where(target)
          .returning()
          .get()!
        changes.push({ type: 'showcaseChanged', sectionIds: [id] })
        return updated
      })
    },

    removeSection(id: string) {
      return commit(storage, ({ db, changes }) => {
        if (!db.delete(sections).where(eq(sections.id, id)).run().changes) {
          throw new DesktopError('NotFound', 'The showcase section does not exist')
        }
        changes.push({ type: 'showcaseChanged', sectionIds: [id] })
      })
    },

    arrangeSections(input: ReorderInput) {
      return commit(storage, ({ db, changes }) => {
        const rows = db
          .select({ id: sections.id, order: sections.sortOrder })
          .from(sections)
          .orderBy(sections.sortOrder, sections.id)
          .all()
        if (
          !isDeepStrictEqual(
            rows.map((row) => row.id),
            input.expected.order,
          )
        ) {
          throw new DesktopError('Conflict', 'The showcase order has changed')
        }
        const selected = new Set(input.order)
        const slots = rows.filter((row) => selected.has(row.id))
        if (slots.length !== selected.size) {
          throw new DesktopError('Conflict', 'A selected section no longer exists')
        }
        if (slots.every((row, i) => row.id === input.order[i])) {
          return
        }
        let i = 0
        for (const [index, row] of rows.entries()) {
          const id = selected.has(row.id) ? input.order[i++]! : row.id
          db.update(sections).set({ sortOrder: index }).where(eq(sections.id, id)).run()
        }
        changes.push({ type: 'showcaseChanged', sectionIds: input.order })
      })
    },
  }
}
