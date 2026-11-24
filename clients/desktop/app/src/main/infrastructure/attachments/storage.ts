import { count, eq, gt, inArray, and, sql } from 'drizzle-orm'
import type { Attachment } from '@kisaki3/desktop-contracts/attachments'
import type { ListOptions } from '@kisaki3/desktop-contracts/operations'
import { attachments } from '../database/schema/attachments/metadata'
import type { Storage } from '../database'

export function adoptAttachments(db: Storage['db'], values: readonly Attachment[]) {
  if (!values.length) {
    return
  }
  const insert = db
    .insert(attachments)
    .values({
      id: sql.placeholder('id'),
      mediaType: sql.placeholder('mediaType'),
      byteSize: sql.placeholder('sizeBytes'),
      sha256: sql.placeholder('sha256'),
      width: sql.placeholder('width'),
      height: sql.placeholder('height'),
      createdAt: sql.placeholder('createdAt'),
    })
    .onConflictDoNothing()
    .prepare()
  for (const attachment of values) {
    insert.run({ ...attachment })
  }
}

function attachment(row: typeof attachments.$inferSelect): Attachment {
  const { byteSize, ...metadata } = row
  return { ...metadata, sizeBytes: byteSize }
}

export function attachmentStorage(storage: Storage) {
  const db = storage.db
  const references = db.all<{ owner: string; field: string }>(
    sql`select m.name owner, f."from" field from sqlite_schema m, pragma_foreign_key_list(m.name) f where m.type='table' and f."table"='attachments'`,
  )
  const unreferenced = sql.join(
    references.map(
      ({ owner, field }) =>
        sql`not exists(select 1 from ${sql.identifier(owner)} where ${sql.identifier(field)}=${attachments.id})`,
    ),
    sql` and `,
  )
  return {
    getAttachment(id: string) {
      const row = db.select().from(attachments).where(eq(attachments.id, id)).get()
      return row ? attachment(row) : null
    },
    listAttachments(options: ListOptions) {
      return storage.transaction((tx) => ({
        items: tx
          .select()
          .from(attachments)
          .orderBy(attachments.id)
          .limit(options.limit)
          .offset(options.offset)
          .all()
          .map(attachment),
        total: tx.select({ n: count() }).from(attachments).get()!.n,
      }))
    },
    attachmentCandidates(after: string | null, limit: number) {
      return db
        .select({ id: attachments.id, unused: unreferenced.mapWith(Boolean) })
        .from(attachments)
        .where(after === null ? undefined : gt(attachments.id, after))
        .orderBy(attachments.id)
        .limit(limit)
        .all()
    },
    reclaimAttachments(ids: readonly string[]) {
      return db
        .delete(attachments)
        .where(and(inArray(attachments.id, [...ids]), unreferenced))
        .returning({ id: attachments.id })
        .all()
    },
  }
}
