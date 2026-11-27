import { dialog, type BrowserWindow } from 'electron'
import { basename } from 'node:path'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { parseListOptions } from '@kisaki3/desktop-contracts/operations'
import { parseFontUpdate, type PreparedFontFile } from '@kisaki3/desktop-contracts/fonts'
import type { FontFileChoice } from '../../../../shared/window-api'
import { rpcData } from '../../../../shared/window-api/protocol'
import { releaseAll, rethrowAfterRelease } from '../../../infrastructure/release'
import type { Application } from '../../compose'
import type { DocumentResources } from '../resources'
import type { DocumentFileInputs } from '../file-inputs'
import { textArgument } from '../values'
import { windowMethod, type WindowMethodGroup } from '../admission'

export function createFontMethods(
  fonts: Application['fonts'],
  window: BrowserWindow,
  resources: DocumentResources,
  fileInputs: DocumentFileInputs,
): WindowMethodGroup<'fonts'> {
  const preparedFonts = new Map<string, PreparedFontFile>()

  async function holdFont(file: PreparedFontFile, signal: AbortSignal) {
    const { hold, urls } = await resources.bind(
      file,
      { font: file.resource },
      signal,
      preparedFonts,
    )
    return { id: hold, attachmentId: file.attachmentId, url: urls.font, metadata: file.metadata }
  }

  function requirePreparedFont(id: unknown) {
    const file = preparedFonts.get(textArgument(id))
    if (!file) {
      throw new DesktopError('InvalidReference', 'The font preparation has ended')
    }
    return file
  }

  return {
    'fonts.list': windowMethod('read', async ([search, options], signal) =>
      rpcData(
        await fonts.list(
          { search: typeof search === 'string' ? search : '' },
          parseListOptions(options),
          { signal },
        ),
      ),
    ),
    'fonts.name': windowMethod('read', ([id], signal) =>
      fonts.getName(textArgument(id), { signal }),
    ),
    'fonts.get': windowMethod('read', async ([id], signal) =>
      rpcData(await fonts.get(textArgument(id), { signal })),
    ),
    'fonts.open': windowMethod('acquire', async ([id], signal) => {
      const read = await fonts.open(textArgument(id), { signal })
      const { hold, urls } = await resources.bind(read, read.resources, signal)
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
        return rethrowAfterRelease(error, () =>
          releaseAll(added.map((id) => () => resources.release(id))),
        )
      }
    }),
    'fonts.prepareInput': windowMethod('acquire', ([token], signal) =>
      fileInputs.consume(token, async (input) => {
        const file = await fonts.prepare(input, { signal })
        return rpcData(await holdFont(file, signal))
      }),
    ),

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
  }
}
