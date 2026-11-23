import { dialog, type BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { parseListOptions, type Disposable } from '@kisaki3/desktop-contracts/operations'
import { parseImageTransform, type PreparedImage } from '@kisaki3/desktop-contracts/images'
import { parseFontUpdate, type PreparedFontFile } from '@kisaki3/desktop-contracts/fonts'
import type { ViewResourcesApi, ReadResourceRef } from '@kisaki3/desktop-contracts/resources'
import { releaseAll } from '../../infrastructure/release'
import { receiveFile } from '../../infrastructure/files/input'
import type { Application } from '../compose'
import type { FontFileChoice, MainWindowApi } from '../../../shared/window-api'
import { rpcData } from '../../../shared/window-api/protocol'
import { textArgument } from './values'
import { windowMethod, type WindowMethods } from './admission'

type FileMethodName = Extract<keyof MainWindowApi, `fonts.${string}` | `images.${string}`>

/** Installs the binary input channel and exposes only operations on this document's actual preparations. */
export function createFileMethods(
  application: Application,
  window: BrowserWindow,
  view: ViewResourcesApi,
  keep: (hold: Disposable, signal: AbortSignal) => Promise<string>,
  release: (id: string) => Promise<void>,
  canReceive: () => boolean,
) {
  const { fonts, images } = application
  const contents = window.webContents
  const fileInputs = new Map<string, ReturnType<typeof receiveFile>>()
  const preparedFonts = new Map<string, PreparedFontFile>()
  const preparedImages = new Map<string, PreparedImage>()

  /** Transfers a file read and its document URLs to the same cancellable window acquisition. */
  async function bind<K extends string>(
    read: Disposable,
    inputs: Readonly<Record<K, ReadResourceRef>>,
    signal: AbortSignal,
  ) {
    const binding = await view.bind(inputs).catch(async (cause: unknown) => {
      await read.dispose()
      throw cause
    })
    const hold = await keep(
      {
        dispose: () => releaseAll([() => binding.dispose(), () => read.dispose()]),
      },
      signal,
    )
    return { hold, urls: binding.urls }
  }

  async function holdFont(file: PreparedFontFile, signal: AbortSignal) {
    const { hold, urls } = await bind(file, { font: file.resource }, signal)
    preparedFonts.set(hold, file)
    return { id: hold, attachmentId: file.attachmentId, url: urls.font, metadata: file.metadata }
  }

  function requirePreparedFont(id: unknown) {
    const file = preparedFonts.get(textArgument(id))
    if (!file) {
      throw new DesktopError('InvalidReference', 'The font preparation has ended')
    }
    return file
  }

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

  async function holdImage(image: PreparedImage, signal: AbortSignal) {
    const { hold, urls } = await bind(image, { image: image.resource }, signal)
    preparedImages.set(hold, image)
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

  const methods = {
    'fonts.list': windowMethod('read', async ([search, options], signal) =>
      rpcData(
        await fonts.list(
          { search: typeof search === 'string' ? search : '' },
          parseListOptions(options),
          { signal },
        ),
      ),
    ),
    'fonts.get': windowMethod('read', async ([id], signal) =>
      rpcData(await fonts.get(textArgument(id), { signal })),
    ),
    'fonts.open': windowMethod('acquire', async ([id], signal) => {
      const read = await fonts.open(textArgument(id), { signal })
      const { hold, urls } = await bind(read, read.resources, signal)
      return rpcData({ font: read.font, hold, urls })
    }),
    'fonts.system': windowMethod('read', async (_args, signal) =>
      rpcData(await fonts.listSystem({ signal })),
    ),

    'fonts.choose': windowMethod('acquire', async (_args, signal) => {
      const { canceled, filePaths } = await dialog.showOpenDialog(window, {
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Fonts', extensions: ['ttf', 'otf', 'woff', 'woff2'] }],
      })
      if (canceled) {
        return null
      }
      const added: string[] = []
      try {
        const result: FontFileChoice[] = []
        for (const path of filePaths) {
          signal.throwIfAborted()
          const name = basename(path)
          try {
            const file = await fonts.prepare({ type: 'path', path }, { signal })
            const prepared = await holdFont(file, signal)
            added.push(prepared.id)
            result.push({ name, file: prepared })
          } catch (cause) {
            signal.throwIfAborted()
            if (cause instanceof DesktopError && cause.code === 'ConnectionClosed') {
              throw cause
            }
            result.push({
              name,
              error:
                cause instanceof DesktopError
                  ? cause.message
                  : 'The font file could not be prepared',
            })
          }
        }
        signal.throwIfAborted()
        return rpcData(result)
      } catch (error) {
        await Promise.all(added.map(release))
        throw error
      }
    }),
    'fonts.prepareInput': windowMethod('acquire', async ([token], signal) => {
      const input = takeInput(token)
      try {
        const file = await fonts.prepare(input, { signal })
        return rpcData(await holdFont(file, signal))
      } finally {
        input.destroy()
      }
    }),

    'fonts.import': windowMethod('write', async ([name, ids], signal) => {
      if (!Array.isArray(ids) || !ids.length) {
        throw new DesktopError('InvalidInput', 'Choose at least one font file')
      }
      const files = ids.map(requirePreparedFont)
      return rpcData(
        await fonts.import(
          { name: textArgument(name), files: [files[0]!, ...files.slice(1)] },
          { signal },
        ),
      )
    }),
    'fonts.update': windowMethod('write', async ([id, input], signal) => {
      const value = parseFontUpdate(input)
      if (value.changes.files?.some((file) => !('attachmentId' in file))) {
        throw new DesktopError('InvalidReference', 'Choose font files in this window')
      }
      return rpcData(await fonts.update(textArgument(id), value, { signal }))
    }),
    'fonts.delete': windowMethod('write', async ([id], signal) =>
      fonts.delete(textArgument(id), { signal }),
    ),
    'fonts.editFiles': windowMethod(
      'write',
      async ([id, name, retained, added, baseline], signal) => {
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
          ...added.map(requirePreparedFont),
        ]
        if (!files.length) {
          throw new DesktopError('InvalidInput', 'Choose at least one font file')
        }
        const filesChanged =
          added.length > 0 ||
          !Array.isArray(baseline.files) ||
          JSON.stringify(retained) !==
            JSON.stringify(
              baseline.files.map((file: { attachmentId: string }) => file.attachmentId),
            )
        const input = parseFontUpdate({
          changes: { ...(name !== baseline.name && { name }), ...(filesChanged && { files }) },
          expected: {
            ...(name !== baseline.name && { name: baseline.name }),
            ...(filesChanged && { files: baseline.files }),
          },
        })
        return rpcData(await fonts.update(textArgument(id), input, { signal }))
      },
    ),

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
    'images.prepareInput': windowMethod('acquire', async ([token], signal) => {
      const input = takeInput(token)
      try {
        return await holdImage(await images.prepare(input, { signal }), signal)
      } finally {
        input.destroy()
      }
    }),
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
  } satisfies WindowMethods<FileMethodName>
  return {
    methods,
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
