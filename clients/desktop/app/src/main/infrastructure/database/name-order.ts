import { sql, type SQL, type SQLWrapper } from 'drizzle-orm'
import { customType } from 'drizzle-orm/sqlite-core'
import type Database from 'better-sqlite3'
import type { UiLocale } from '@kisaki3/desktop-contracts/i18n'

export function orderedName(name: SQLWrapper): SQL {
  return sql`${name} collate kisaki_name`
}

export const orderedText = customType<{ data: string; driverData: string }>({
  dataType: () => 'text collate kisaki_name',
})

export function openNameOrder(connection: Database.Database): (locale: UiLocale) => void {
  const previous = connection
    .prepare('select locale,revision from name_order_state where id=1')
    .get() as { locale: string; revision: string } | undefined
  let activeLocale = previous?.locale ?? 'en'
  const configure = connection.prepare('select kisaki_set_name_locale(?)').pluck()
  const revision = configure.get(activeLocale) as string

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
