/** @fileoverview Holds an intentionally uncommitted transaction until the interruption test terminates this process. */

import { sql } from 'drizzle-orm'
import { initializeDatabase } from '../../../src/main/infrastructure/database'
import { entries } from '../../../src/main/infrastructure/database/schema'
import { storageOptions } from './fixture'

const directory = process.argv[2]
if (!directory || !process.send) {
  throw new Error('The interruption worker requires a test directory and IPC parent')
}
const storage = initializeDatabase(storageOptions(directory))
storage.db
  .insert(entries)
  .values({ id: 'committed', type: 'game', name: 'Saved', createdAt: 1, updatedAt: 1 })
  .run()
storage.db.run(sql`begin immediate`)
storage.db.run(sql`update entries set name = 'Uncommitted' where id = 'committed'`)
process.send('transaction-open')
setInterval(() => {}, 1000)
