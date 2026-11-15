/** @fileoverview Exercises formal storage and packaged migration resources in the real Electron carrier. */

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import type { NativeFiles } from '#native'
import { initializeDatabase } from '../../../../../../src/main/infrastructure/database'
import { entries, games } from '../../../../../../src/main/infrastructure/database/schema'
import { assertLocalDataDirectory } from '../../../../../../src/main/infrastructure/files'
import { getPreferenceDefaults } from '../../../../../../src/main/features/preferences/defaults'

/** Opens an isolated profile through the real migration chain, persists one fact and reopens it. */
export async function verifyStorage(
  profile: string,
  resources: string,
  native: NativeFiles,
): Promise<void> {
  await assertLocalDataDirectory(profile, native)
  assert(['win32', 'darwin', 'linux'].includes(process.platform))
  const platform = process.platform as 'win32' | 'darwin' | 'linux'
  const options = {
    path: join(profile, 'library.sqlite'),
    nativeBinding: join(resources, 'native/better-sqlite3.node'),
    collationExtension: join(resources, 'native/kisaki-native.node'),
    migrationsDirectory: join(resources, 'drizzle'),
    defaults: getPreferenceDefaults(platform, []),
  }
  let storage = initializeDatabase(options)
  try {
    storage.adoptLocale('en')
    if (!storage.db.select().from(entries).where(eq(entries.id, 'fixture')).get()) {
      storage.db.transaction((transaction) => {
        transaction
          .insert(entries)
          .values({ id: 'fixture', type: 'game', name: '資料 ２', createdAt: 1, updatedAt: 1 })
          .run()
        transaction
          .insert(games)
          .values({ entryId: 'fixture', releaseDate: { year: 0, month: 2, day: 29 } })
          .run()
      })
    }
    storage.close()
    storage = initializeDatabase(options)
    storage.adoptLocale('en')
    assert.equal(
      storage.db.select().from(entries).where(eq(entries.id, 'fixture')).get()?.name,
      '資料 ２',
    )
    assert.deepEqual(storage.db.select().from(games).get()?.releaseDate, {
      year: 0,
      month: 2,
      day: 29,
    })
    assert.equal(
      storage.db.select().from(storage.preferences).get()?.general.uiTranslation.status,
      'ready',
    )
  } finally {
    storage.close()
  }
}
