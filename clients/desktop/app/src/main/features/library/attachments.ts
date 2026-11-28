import { readMarkdown } from '../../infrastructure/markdown'
import { eq } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { PreparedAttachment } from '@kisaki3/desktop-contracts/resources'
import { attachments as metadata } from '../../infrastructure/database/schema'
import type { createAttachments } from '../../infrastructure/attachments'
import type { LibraryDatabase } from './transaction'

export function inlineImages(text: string | null | undefined) {
  return readMarkdown(text).inlineImages
}

export function imageIds(value: object): string[] {
  const ids = new Set<string>()
  for (const key of ['primaryImageId', 'backdropImageId', 'titleLogoId', 'iconImageId'] as const) {
    const id: unknown = Reflect.get(value, key)
    if (typeof id === 'string') {
      ids.add(id)
    }
  }
  const description: unknown = Reflect.get(value, 'description')
  if (typeof description === 'string') {
    for (const id of inlineImages(description)) {
      ids.add(id)
    }
  }
  return [...ids]
}

export function prepareImages(
  attachments: ReturnType<typeof createAttachments>,
  ids: readonly string[],
  prepared: readonly PreparedAttachment[],
) {
  return attachments.forSave(
    ids,
    new Map(prepared.map((item) => [item.attachmentId, item.resource])),
  )
}

export function checkImages(db: LibraryDatabase, ids: readonly string[]) {
  for (const id of ids) {
    const item = db
      .select({ type: metadata.mediaType, width: metadata.width, height: metadata.height })
      .from(metadata)
      .where(eq(metadata.id, id))
      .get()
    if (!item?.type.startsWith('image/') || !item.width || !item.height) {
      throw new DesktopError(
        'InvalidReference',
        'A catalog image must be a prepared or stored image',
      )
    }
  }
}
