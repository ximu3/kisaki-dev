import { count, eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { Font, FontFile, FontUpdate } from '@kisaki3/desktop-contracts/fonts'
import type { Attachment } from '@kisaki3/desktop-contracts/attachments'
import type { ListOptions } from '@kisaki3/desktop-contracts/operations'
import type { Storage } from '../../infrastructure/database'
import { fonts, fontAttachments } from '../../infrastructure/database/schema/application'
import { ready } from '../../infrastructure/database/codecs/json'
import { adoptAttachments } from '../../infrastructure/attachments/storage'

/** Reads the complete font definition from one database snapshot. */
function readFont(db: Storage['db'], id: string): Font | null {
  const row = db.select().from(fonts).where(eq(fonts.id, id)).get()
  if (!row) {
    return null
  }
  const files = db
    .select()
    .from(fontAttachments)
    .where(eq(fontAttachments.fontId, id))
    .orderBy(fontAttachments.attachmentId)
    .all()
    .map((file) => {
      if (file.metadata.status === 'invalid') {
        throw new DesktopError(file.metadata.error.code, file.metadata.error.message)
      }
      return { attachmentId: file.attachmentId, metadata: file.metadata.value }
    })
  if (!files.length) {
    throw new DesktopError('DataIntegrityError', 'The font has no files')
  }
  return { ...row, files: [files[0]!, ...files.slice(1)] }
}

/** Installs a nonempty final file set, reusing only the records actually owned by this font. */
function replaceFiles(tx: Storage['db'], id: string, files: readonly FontFile[]) {
  tx.delete(fontAttachments).where(eq(fontAttachments.fontId, id)).run()
  tx.insert(fontAttachments)
    .values(
      files.map((file) => ({
        fontId: id,
        attachmentId: file.attachmentId,
        metadata: ready(file.metadata),
      })),
    )
    .run()
}

/** A new font and all verified bytes to adopt in the transaction creating it. */
export interface NewFont {
  id: string
  name: string
  files: readonly FontFile[]
  attachments: readonly Attachment[]
}

/** Commits a new font and its verified files inside the font or theme creator's transaction. */
export function adoptNewFont(tx: Storage['db'], input: NewFont) {
  const now = Date.now()
  tx.insert(fonts).values({ id: input.id, name: input.name, createdAt: now, updatedAt: now }).run()
  adoptAttachments(tx, input.attachments)
  replaceFiles(tx, input.id, input.files)
}

/** Provides serial worker operations for font metadata and its attachment references. */
export function fontStorage({ transaction }: Storage) {
  return {
    /** Reads a complete font and its files in one transaction. */
    getFont: (id: string) => transaction((tx) => readFont(tx, id)),
    /** Queries the font library with a count under the same filter. */
    listFonts(search: string, options: ListOptions) {
      const filter = search ? sql`instr(lower(${fonts.name}),lower(${search}))` : undefined
      return transaction((tx) => ({
        items: tx
          .select()
          .from(fonts)
          .where(filter)
          .orderBy(fonts.name, fonts.id)
          .offset(options.offset)
          .limit(options.limit)
          .all(),
        total: tx.select({ n: count() }).from(fonts).where(filter).get()!.n,
      }))
    },
    /** Compares and commits an entire font edit and its newly adopted attachments. */
    saveFont(
      id: string | null,
      name: string | undefined,
      files: readonly FontFile[] | undefined,
      prepared: readonly Attachment[],
      expected: FontUpdate['expected'],
    ) {
      return transaction((tx) => {
        if (id === null) {
          const created = randomUUID()
          adoptNewFont(tx, { id: created, name: name!, files: files!, attachments: prepared })
          return { font: readFont(tx, created)!, released: [] as string[] }
        }

        const original = readFont(tx, id)
        if (!original) {
          throw new DesktopError('NotFound', 'The font does not exist')
        }

        if (
          (expected?.name !== undefined && expected.name !== original.name) ||
          (expected?.files && !isDeepStrictEqual(expected.files, original.files))
        ) {
          throw new DesktopError('Conflict', 'The font was changed')
        }

        const now = Date.now()
        tx.update(fonts)
          .set({ ...(name !== undefined && { name }), updatedAt: now })
          .where(eq(fonts.id, id))
          .run()
        if (files) {
          const additions = new Set(prepared.map((file) => file.id))
          if (
            files.some(
              (file) =>
                !additions.has(file.attachmentId) &&
                !original.files.some((old) => old.attachmentId === file.attachmentId),
            )
          ) {
            throw new DesktopError(
              'InvalidReference',
              'The retained file does not belong to this font',
            )
          }
          adoptAttachments(tx, prepared)
          replaceFiles(tx, id, files)
        }

        const font = readFont(tx, id)!
        const retained = new Set(font.files.map((file) => file.attachmentId))
        return {
          font,
          released: original.files
            .map((file) => file.attachmentId)
            .filter((key) => !retained.has(key)),
        }
      }, 'immediate')
    },
    /** Deletes the user font while foreign keys release only its file links. */
    deleteFont(id: string) {
      return transaction((tx) => {
        const released = tx
          .select({ id: fontAttachments.attachmentId })
          .from(fontAttachments)
          .where(eq(fontAttachments.fontId, id))
          .all()
        if (!tx.delete(fonts).where(eq(fonts.id, id)).run().changes) {
          throw new DesktopError('NotFound', 'The font does not exist')
        }
        return released.map((row) => row.id)
      }, 'immediate')
    },
  }
}
