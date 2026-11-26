import { dialog, type BrowserWindow } from 'electron'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { parseImageTransform, type PreparedImage } from '@kisaki3/desktop-contracts/images'
import { rpcData } from '../../../../shared/window-api/protocol'
import type { Application } from '../../compose'
import type { DocumentResources } from '../resources'
import type { DocumentFileInputs } from '../file-inputs'
import { textArgument } from '../values'
import { windowMethod, type WindowMethodGroup } from '../admission'

export function createImageMethods(
  images: Application['images'],
  window: BrowserWindow,
  resources: DocumentResources,
  fileInputs: DocumentFileInputs,
): WindowMethodGroup<'images'> {
  const preparedImages = new Map<string, PreparedImage>()

  async function holdImage(image: PreparedImage, signal: AbortSignal) {
    const { hold, urls } = await resources.bind(
      image,
      { image: image.resource },
      signal,
      preparedImages,
    )
    return rpcData({
      id: hold,
      attachmentId: image.attachmentId,
      width: image.width,
      height: image.height,
      frameCount: image.frameCount,
      format: image.format,
      url: urls.image,
    })
  }

  return {
    'images.choose': windowMethod('acquire', async (_args, signal) => {
      const { canceled, filePaths } = await dialog.showOpenDialog(window, {
        properties: ['openFile'],
        filters: [
          {
            name: 'Images',
            extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'ico'],
          },
        ],
      })
      if (canceled) {
        return null
      }
      return holdImage(
        await images.prepare({ type: 'path', path: filePaths[0]! }, { signal }),
        signal,
      )
    }),
    'images.prepareInput': windowMethod('acquire', ([token], signal) =>
      fileInputs.consume(token, async (input) =>
        holdImage(await images.prepare(input, { signal }), signal),
      ),
    ),
    'images.transform': windowMethod('acquire', async ([id, input], signal) => {
      const source = preparedImages.get(textArgument(id))
      if (!source) {
        throw new DesktopError('InvalidReference', 'The image preparation has ended')
      }
      return holdImage(
        await images.transform(source.resource, parseImageTransform(input), { signal }),
        signal,
      )
    }),
  }
}
