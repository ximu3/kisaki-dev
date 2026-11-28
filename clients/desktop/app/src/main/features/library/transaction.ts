import { isDeepStrictEqual } from 'node:util'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { LibraryChange } from '@kisaki3/desktop-contracts/library'
import type { Storage } from '../../infrastructure/database'

export type LibraryDatabase = Storage['db']

export interface LibraryCommit<T> {
  value: T
  changes: LibraryChange[]
  released: string[]
  committedAt: number
}

export type CompleteWrite = <T>(commit: LibraryCommit<T>) => T

export interface LibraryWrite {
  db: LibraryDatabase
  now: number
  changes: LibraryChange[]
  released: Set<string>
}

export function commit<T>(
  storage: Storage,
  operation: (write: LibraryWrite) => T,
): LibraryCommit<T> {
  return storage.transaction((db) => {
    const write: LibraryWrite = { db, now: Date.now(), changes: [], released: new Set() }
    const value = operation(write)
    return { value, changes: write.changes, released: [...write.released], committedAt: write.now }
  }, 'immediate')
}

export function expectFields<T extends object>(
  actual: T,
  expected: Partial<NoInfer<T>> | undefined,
) {
  for (const key of Object.keys(expected ?? {}) as (keyof T)[]) {
    if (!isDeepStrictEqual(actual[key], expected![key])) {
      throw new DesktopError('Conflict', `The saved field "${String(key)}" has changed`)
    }
  }
}
