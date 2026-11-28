import type Database from 'better-sqlite3'
import { readMarkdown } from '../markdown'

export function searchText(value: string) {
  return value.normalize('NFKC').toLowerCase()
}

export function registerSearchText(connection: Database.Database) {
  connection.function('library_text', { deterministic: true }, (value: string | null) =>
    value === null ? '' : searchText(value),
  )
  connection.function('library_markdown', { deterministic: true }, (value: string | null) =>
    value === null ? '' : searchText(readMarkdown(value).text),
  )
}
