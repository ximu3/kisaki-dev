import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { parseWorkRef, type ContentDirectoriesApi } from '@kisaki3/desktop-contracts/library'
import { shell } from 'electron'
import { stat } from 'node:fs/promises'
import { rpcData } from '../../../../../../shared/window-api/protocol'
import type { Application } from '../../../../compose'
import { windowMethod } from '../../../admission'
import { textArgument } from '../../../values'

export function directoryMethods(holdings: Application['library']['holdings']) {
  const { directories } = holdings
  return {
    'library.holdings.directories': windowMethod('read', async ([work]) =>
      rpcData(await directories.list(parseWorkRef(work))),
    ),
    'library.holdings.updateDirectory': windowMethod('write', ([work, id, input], signal) =>
      directories.update(work, textArgument(id), input, { signal }),
    ),
    'library.holdings.removeDirectory': windowMethod('write', ([work, id], signal) =>
      directories.delete(work, textArgument(id), { signal }),
    ),
    'library.holdings.relocateDirectory': windowMethod('write', async ([work, id, input], signal) =>
      rpcData(
        await directories.relocate(
          ...([work, textArgument(id), input, { signal }] as unknown as Parameters<
            ContentDirectoriesApi['relocate']
          >),
        ),
      ),
    ),
    'library.holdings.previewDirectory': windowMethod(
      'read',
      async ([work, id, definition, profile], signal) =>
        rpcData(
          await directories.preview(
            work,
            textArgument(id),
            definition,
            profile === null ? null : textArgument(profile),
            signal,
          ),
        ),
    ),
    'library.holdings.openDirectory': windowMethod('control', async ([work, id]) => {
      const dir = await directories.get(parseWorkRef(work), textArgument(id))
      if (!dir || !(await stat(dir.path)).isDirectory()) {
        throw new DesktopError('FileUnavailable', 'The registered directory is unavailable')
      }
      const error = await shell.openPath(dir.path)
      if (error) {
        throw new DesktopError('OpenFailed', error)
      }
    }),
  }
}
