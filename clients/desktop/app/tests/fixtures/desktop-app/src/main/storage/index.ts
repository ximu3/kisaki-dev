/** @fileoverview Exercises formal storage and packaged migration resources in the real Electron carrier. */

import assert from 'node:assert/strict'
import { join } from 'node:path'
import type { NativeFiles } from '#native'
import { openDatabaseExecutor } from '../../../../../../src/main/infrastructure/database'
import { assertLocalDataDirectory } from '../../../../../../src/main/infrastructure/files'
import { getPreferenceDefaults } from '../../../../../../src/main/features/preferences/defaults'

/** Verifies the deployed worker, migration chain, preference read and adoption of the fixture language. */
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
  const entry = new URL('./database.js', import.meta.url)
  const database = await openDatabaseExecutor(entry, options)
  try {
    const preferences = await database.readPreferences()
    assert.equal(preferences.general.uiTranslation.status, 'ready')
    await database.adoptLocale('en')
  } finally {
    await database.close()
  }
}
