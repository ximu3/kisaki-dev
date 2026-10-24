import { drizzle } from 'drizzle-orm/better-sqlite3'
import { entries, relations, type ProbeDate } from './schema.js'

const db = drizzle.mock({ relations })
const values: Array<{ id: string; name: string; released: ProbeDate | null; favorite: boolean }> =
  db.select().from(entries).all()
const result:
  { id: string; name: string; released: ProbeDate | null; favorite: boolean } | undefined = db
  .select()
  .from(entries)
  .get()
const relational = db.query.entries.findMany({ with: { identities: true } }).sync()
const date: ProbeDate | null | undefined = relational[0]?.released
const identity: string | undefined = relational[0]?.identities[0]?.sourceId
const changed: number = db.update(entries).set({ name: 'changed' }).run().changes
const synchronous: number = db.transaction((tx) => tx.select().from(entries).all().length)
// @ts-expect-error A boolean column rejects an arbitrary string.
db.insert(entries).values({ id: 'invalid', name: 'invalid', favorite: 'yes' })
// @ts-expect-error A nullable date still requires its declared numeric year.
db.insert(entries).values({ id: 'invalid', name: 'invalid', released: { year: '2024' } })
void [values, result, date, identity, changed, synchronous]
