import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { Application } from '../../../compose'
import { windowMethod } from '../../admission'
import { textArgument } from '../../values'
import type { PreparedImage } from '@kisaki3/desktop-contracts/images'
import { readMarkdown } from '../../../../infrastructure/markdown'
import type { DocumentResources } from '../../resources'
export function preparedInput(images: ReadonlyMap<string, PreparedImage>) {
  return function (value: unknown, ids: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || 'prepared' in value) {
      throw new DesktopError('InvalidInput', 'Expected entry fields')
    }
    if (ids === undefined) {
      return { ...value }
    }
    if (!Array.isArray(ids)) {
      throw new DesktopError('InvalidInput', 'Expected prepared image handles')
    }
    return {
      ...value,
      prepared: ids.map((token) => {
        const image = images.get(textArgument(token))
        if (!image) {
          throw new DesktopError('InvalidReference', 'The image preparation is no longer available')
        }
        return image
      }),
    }
  }
}
export type PreparedInput = ReturnType<typeof preparedInput>
export function imageMethods(app: Application, resources: DocumentResources) {
  return {
    'library.images.inMarkdown': windowMethod(
      'read',
      ([raw]) => readMarkdown(textArgument(raw)).inlineImages,
    ),
    'library.images.open': windowMethod('acquire', async ([raw], signal) => {
      const id = textArgument(raw)
      const image = await app.attachments.get(id, { signal })
      if (!image?.mediaType.startsWith('image/') || !image.width || !image.height) {
        throw new DesktopError('NotFound', 'The image is unavailable')
      }
      const read = await app.attachments.read(id, { signal })
      const { hold, urls } = await resources.bind(read, { image: read.resource }, signal)
      return { hold, url: urls.image }
    }),
  }
}
