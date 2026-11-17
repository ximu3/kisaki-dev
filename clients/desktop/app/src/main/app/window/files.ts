/** @fileoverview Binds file grants, verified font edits and image preparations to the native document that owns them. */

import { dialog, type BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import type { RpcMethod } from '@kisaki3/desktop-rpc'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { parseJsonValue } from '@kisaki3/desktop-contracts/json'
import { parseListOptions } from '@kisaki3/desktop-contracts/operations'
import { parseImageTransform, type PreparedImage } from '@kisaki3/desktop-contracts/images'
import { parseFontUpdate, type PreparedFontFile } from '@kisaki3/desktop-contracts/fonts'
import type { ViewResourcesApi, ViewResourceBinding } from '@kisaki3/desktop-contracts/resources'
import { receiveFile } from '../../infrastructure/files/input'
import type { Application } from '../compose'
import { textArgument } from './values'

/** Installs the binary input channel and exposes only operations on this document's actual preparations. */
export function createFileMethods(
  application: Application,
  window: BrowserWindow,
  view: ViewResourcesApi,
  keep: (hold: {
    /** Releases the resource represented by this document-owned handle. */
    dispose(): void | Promise<void>
  }) => string,
  release: (id: string) => Promise<void>,
  canReceive: () => boolean,
) {
  const { fonts, images } = application
  const contents = window.webContents
  const preparedFonts = new Map<string, PreparedFontFile>()
  /** Hands the editor both the verified font and a preview bound to its own document. */
  async function fontResult(file: PreparedFontFile) {
    let binding: ViewResourceBinding<'font'> | undefined
    try {
      binding = await view.bind({ font: file.resource })
      const id = keep({
        /** Releases the temporary font file and its bound preview. */
        async dispose() {
          await binding!.dispose()
          await file.dispose()
        },
      })
      preparedFonts.set(id, file)
      return { id, url: binding.urls.font, metadata: file.metadata }
    } catch (error) {
      await binding?.dispose()
      await file.dispose()
      throw error
    }
  }
  const fileInputs = new Map<string, ReturnType<typeof receiveFile>>()
  /** Acquires the incoming binary port only from this bound top-level document. */
  const receiveInput = (event: Electron.IpcMainEvent) => {
    const port = event.ports[0]
    if (!port) {
      return
    }
    if (!canReceive() || event.senderFrame !== contents.mainFrame || fileInputs.size >= 32) {
      port.close()
      return
    }
    const id = randomUUID()
    const stream = receiveFile(port)
    fileInputs.set(id, stream)
    stream.once('close', () => fileInputs.delete(id))
    port.postMessage({ id })
  }
  contents.ipc.on('kisaki-file-input', receiveInput)
  /** Consumes a file grant exactly once in the document that supplied its port. */
  function takeInput(id: unknown) {
    const key = textArgument(id)
    const stream = fileInputs.get(key)
    if (!stream) {
      throw new DesktopError('InvalidReference', 'The file input is unavailable')
    }
    fileInputs.delete(key)
    return stream
  }
  const preparedImages = new Map<string, PreparedImage>()

  /** Binds a verified image for preview, pairing the binding and preparation in one editing lifetime. */
  async function imageResult(image: PreparedImage) {
    let binding: ViewResourceBinding<'image'> | undefined
    try {
      binding = await view.bind({ image: image.resource })
      const id = keep({
        /** Releases the prepared image and its document-specific preview binding. */
        async dispose() {
          await binding!.dispose()
          await image.dispose()
        },
      })
      preparedImages.set(id, image)
      return parseJsonValue({
        id,
        attachmentId: image.attachmentId,
        width: image.width,
        height: image.height,
        frameCount: image.frameCount,
        format: image.format,
        url: binding.urls.image,
      })
    } catch (error) {
      await binding?.dispose()
      await image.dispose()
      throw error
    }
  }

  const methods = {
    /** Searches the user font collection one bounded interval at a time. */
    'fonts.list': async ([search, options]) =>
      parseJsonValue(
        await fonts.list(
          { search: typeof search === 'string' ? search : '' },
          parseListOptions(options),
        ),
      ),
    /** Reads the font name and its complete verified file set. */
    'fonts.get': async ([id]) => parseJsonValue(await fonts.get(textArgument(id))),
    /** Lists distinct family names from the actual operating-system font catalog. */
    'fonts.system': async (_args, signal) => parseJsonValue(await fonts.listSystem({ signal })),
    /** Prepares selected native files for this editor and returns null on cancellation. */
    'fonts.choose': async (_args, signal) => {
      const { canceled, filePaths } = await dialog.showOpenDialog(window, {
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Fonts', extensions: ['ttf', 'otf', 'woff', 'woff2'] }],
      })
      if (canceled) {
        return null
      }
      const added: string[] = []
      try {
        const result = []
        for (const path of filePaths) {
          const file = await fonts.prepare({ type: 'path', path }, { signal })
          const prepared = await fontResult(file)
          added.push(prepared.id)
          result.push(prepared)
        }
        return parseJsonValue(result)
      } catch (error) {
        await Promise.all(added.map(release))
        throw error
      }
    },
    /** Consumes a document-owned file stream and returns a verified font preview. */
    'fonts.prepareInput': async ([token], signal) => {
      const input = takeInput(token)
      try {
        const file = await fonts.prepare(input, { signal })
        return parseJsonValue(await fontResult(file))
      } finally {
        input.destroy()
      }
    },
    /** Commits the chosen name and the verified files held by this document. */
    'fonts.import': async ([name, ids], signal) => {
      if (!Array.isArray(ids) || !ids.length) {
        throw new DesktopError('InvalidInput', 'Choose at least one font file')
      }
      const files = ids.map((id) => {
        const file = preparedFonts.get(textArgument(id))
        if (!file) {
          throw new DesktopError('InvalidReference', 'The font preparation has ended')
        }
        return file
      })
      return parseJsonValue(
        await fonts.import(
          { name: textArgument(name), files: [files[0]!, ...files.slice(1)] },
          { signal },
        ),
      )
    },
    /** Commits a validated name or retained-file edit against its original values. */
    'fonts.update': async ([id, input], signal) => {
      const value = parseFontUpdate(input)
      if (value.changes.files?.some((file) => !('attachmentId' in file))) {
        throw new DesktopError('InvalidReference', 'Choose font files in this window')
      }
      return parseJsonValue(await fonts.update(textArgument(id), value, { signal }))
    },
    /** Deletes the font record and removes its references to attachment bytes. */
    'fonts.delete': async ([id]) => fonts.delete(textArgument(id)),
    /** Resolves retained and newly prepared files before committing the edited font. */
    'fonts.editFiles': async ([id, name, retained, added, baseline], signal) => {
      if (
        !Array.isArray(retained) ||
        !Array.isArray(added) ||
        !baseline ||
        typeof baseline !== 'object' ||
        !('name' in baseline) ||
        !('files' in baseline)
      ) {
        throw new DesktopError('InvalidInput', 'Invalid font edit')
      }
      const files = [
        ...retained.map((item) => ({ attachmentId: textArgument(item) })),
        ...added.map((item) => {
          const file = preparedFonts.get(textArgument(item))
          if (!file) {
            throw new DesktopError('InvalidReference', 'The font preparation has ended')
          }
          return file
        }),
      ]
      if (!files.length) {
        throw new DesktopError('InvalidInput', 'Choose at least one font file')
      }
      const filesChanged =
        added.length > 0 ||
        !Array.isArray(baseline.files) ||
        JSON.stringify(retained) !==
          JSON.stringify(baseline.files.map((file: { attachmentId: string }) => file.attachmentId))
      const input = parseFontUpdate({
        changes: { ...(name !== baseline.name && { name }), ...(filesChanged && { files }) },
        expected: {
          ...(name !== baseline.name && { name: baseline.name }),
          ...(filesChanged && { files: baseline.files }),
        },
      })
      return parseJsonValue(await fonts.update(textArgument(id), input, { signal }))
    },
    /** Prepares a user-selected image and binds its preview to this document. */
    'images.choose': async (_args, signal) => {
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
      return await imageResult(
        await images.prepare({ type: 'path', path: filePaths[0]! }, { signal }),
      )
    },
    /** Consumes selected browser bytes into a verified and scoped image preview. */
    'images.prepareInput': async ([token], signal) => {
      const input = takeInput(token)
      try {
        return await imageResult(await images.prepare(input, { signal }))
      } finally {
        input.destroy()
      }
    },
    /** Applies the selected transforms to a held image and returns a new preparation. */
    'images.transform': async ([id, input], signal) => {
      const source = preparedImages.get(textArgument(id))
      if (!source) {
        throw new DesktopError('InvalidReference', 'The image preparation has ended')
      }
      return imageResult(
        await images.transform(source.resource, parseImageTransform(input), { signal }),
      )
    },
  } satisfies Record<string, RpcMethod>
  return {
    methods,
    /** Drops the resource lookup alongside its shared document release handle. */
    forget(id: string) {
      preparedFonts.delete(id)
      preparedImages.delete(id)
    },
    /** Ends unread file inputs and removes the previous document's lookup tables on reload. */
    close() {
      contents.ipc.off('kisaki-file-input', receiveInput)
      for (const input of fileInputs.values()) {
        input.destroy()
      }
      fileInputs.clear()
      preparedImages.clear()
      preparedFonts.clear()
    },
  }
}
