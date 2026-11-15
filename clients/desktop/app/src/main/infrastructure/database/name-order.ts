/** @fileoverview Owns the SQL name comparison, its index provenance and atomic locale changes. */

import { sql } from 'drizzle-orm'
import type { SQL, SQLWrapper } from 'drizzle-orm'
import { customType } from 'drizzle-orm/sqlite-core'
import type Database from 'better-sqlite3'
import type { UiLocale } from '@kisaki3/desktop-contracts/i18n'

/** Applies the connection's ICU ordering to a name in an index, interval or position predicate. */
export function orderedName(name: SQLWrapper): SQL {
  return sql`${name} collate kisaki_name`
}

/** Declares collated text for a derived title without changing the equality of authored names. */
export const orderedText = customType<{ data: string; driverData: string }>({
  /** Gives SQLite's composite index and row-value comparisons the same declared collation. */
  dataType: () => 'text collate kisaki_name',
})

/**
 * Opens existing indexes in the locale that built them; a new library starts in built-in English.
 * Main adopts the effective locale once the saved translation has resolved, before serving lists.
 */
export function openNameOrder(connection: Database.Database): (locale: UiLocale) => void {
  const previous = connection
    .prepare('select locale,revision from name_order_state where id=1')
    .get() as { locale: string; revision: string } | undefined
  let activeLocale = previous?.locale ?? 'en'
  const configure = connection.prepare('select kisaki_set_name_locale(?)').pluck()
  const revision = configure.get(activeLocale) as string

  /** Rebuilds every index using this collation and records its provenance in the same transaction. */
  function rebuild(locale: UiLocale): void {
    connection.exec('reindex kisaki_name')
    connection
      .prepare(
        'insert into name_order_state (id,locale,revision) values (1,?,?) on conflict(id) do update set locale=excluded.locale,revision=excluded.revision',
      )
      .run(locale, revision)
  }

  if (previous?.revision !== revision) {
    connection.transaction(() => rebuild(activeLocale)).immediate()
  }

  /** Adopts an effective locale atomically, restoring the previous comparator on rollback. */
  return function adoptLocale(locale: UiLocale): void {
    if (locale === activeLocale) {
      return
    }
    if (connection.inTransaction) {
      throw new Error('Changing the name order requires ownership of the transaction')
    }
    try {
      connection
        .transaction(() => {
          configure.get(locale)
          rebuild(locale)
        })
        .immediate()
    } catch (cause) {
      configure.get(activeLocale)
      throw cause
    }
    activeLocale = locale
  }
}
