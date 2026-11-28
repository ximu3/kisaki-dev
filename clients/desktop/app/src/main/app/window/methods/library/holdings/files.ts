import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { parseFilePlaybackChoicesUpdate } from '@kisaki3/desktop-contracts/library'
import { shell } from 'electron'
import { stat } from 'node:fs/promises'
import { rpcData } from '../../../../../../shared/window-api/protocol'
import { fileWork } from '../../../../../features/library/holdings'
import type { Application } from '../../../../compose'
import { windowMethod } from '../../../admission'
import { textArgument } from '../../../values'

function fileIds(value: unknown) {
  if (!Array.isArray(value) || !value.length) {
    throw new DesktopError('InvalidInput', 'Choose one or more files')
  }
  const ids = value.map(textArgument)
  if (new Set(ids).size !== ids.length) {
    throw new DesktopError('InvalidInput', 'Choose distinct files')
  }
  return ids
}

export function fileMethods(holdings: Application['library']['holdings']) {
  const { files } = holdings
  return {
    'library.files.playbackChoices': windowMethod('write', ([anime, file, input], signal) =>
      files.playbackChoices.update(
        textArgument(anime),
        textArgument(file),
        parseFilePlaybackChoicesUpdate(input),
        { signal },
      ),
    ),
    'library.files.list': windowMethod('read', async ([work, query, range]) =>
      rpcData(await files.list(fileWork(work), query, range)),
    ),
    'library.files.get': windowMethod('read', async ([work, id]) =>
      rpcData(await files.get(fileWork(work), textArgument(id))),
    ),
    'library.files.add': windowMethod('write', ([work, input], signal) =>
      files.add(work, input, { signal }),
    ),
    'library.files.update': windowMethod('write', ([work, id, input], signal) =>
      files.update(work, textArgument(id), input, { signal }),
    ),
    'library.files.remove': windowMethod('write', ([work, ids], signal) =>
      files.delete(work, fileIds(ids), { signal }),
    ),
    'library.files.reveal': windowMethod('control', async ([work, id]) => {
      const file = await files.get(fileWork(work), textArgument(id))
      if (!file) {
        throw new DesktopError('NotFound', 'The registered file does not exist')
      }
      const actual = await stat(file.path)
      if (file.kind === 'directory') {
        if (!actual.isDirectory()) {
          throw new DesktopError('FileUnavailable', 'The image directory is unavailable')
        }
        const error = await shell.openPath(file.path)
        if (error) {
          throw new DesktopError('OpenFailed', error)
        }
      } else {
        shell.showItemInFolder(file.path)
      }
    }),
    'library.files.relocate': windowMethod('write', async ([work, id, path, expected], signal) =>
      rpcData(
        await files.relocate(
          fileWork(work),
          textArgument(id),
          { path: textArgument(path), expected: { path: textArgument(expected) } },
          { signal },
        ),
      ),
    ),
    'library.files.merge': windowMethod('write', async ([work, input], signal) =>
      rpcData(await files.merge(work, input, { signal })),
    ),
    'library.files.associations': windowMethod('write', ([work, id, input], signal) =>
      files.editAssociations(work, textArgument(id), input, { signal }),
    ),
    'library.files.setMode': windowMethod('write', ([work, id, mode, expected], signal) => {
      if (
        (mode !== 'automatic' && mode !== 'manual') ||
        (expected !== 'automatic' && expected !== 'manual')
      ) {
        throw new DesktopError('InvalidInput', 'Invalid association mode')
      }
      return files.setAssociationMode(
        work,
        textArgument(id),
        { mode, expected: { associationMode: expected } },
        { signal },
      )
    }),
    'library.files.setPreferred': windowMethod('write', ([work, input], signal) =>
      files.setPreferred(work, input, { signal }),
    ),
    'library.files.setPreferredMany': windowMethod('write', ([work, input], signal) =>
      files.setPreferredMany(work, input, { signal }),
    ),
    'library.files.inspectVideo': windowMethod('write', async ([work, id], signal) =>
      rpcData(await files.information(work, textArgument(id), signal)),
    ),
    'library.files.testRecognition': windowMethod('read', async ([work, id, input], signal) =>
      rpcData(await files.testRecognition(fileWork(work), textArgument(id), input, { signal })),
    ),
    'library.files.reidentify': windowMethod('write', async ([work, ids], signal) =>
      rpcData(await files.reidentify(fileWork(work), fileIds(ids), { signal })),
    ),
  }
}
