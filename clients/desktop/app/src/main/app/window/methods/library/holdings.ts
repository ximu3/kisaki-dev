import { dialog, shell, type BrowserWindow } from 'electron'
import { stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { Application } from '../../../compose'
import { rpcData } from '../../../../../shared/window-api/protocol'
import type { HoldingsWindowApi } from '../../../../../shared/window-api/library/holdings'
import { fileMedium } from '../../../../features/library/holdings/recognition/profiles'
import { textArgument } from '../../values'
import { windowMethod, type WindowMethods } from '../../admission'

import { parseWorkRef, type ContentDirectoriesApi } from '@kisaki3/desktop-contracts/library'
import { fileWork } from '../../../../features/library/holdings'
import type {
  UsagePreferenceTarget,
  HoldingsPreferencesApi,
} from '@kisaki3/desktop-contracts/library'
import { parseFilePlaybackChoicesUpdate } from '@kisaki3/desktop-contracts/library'
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
export function createHoldingMethods(
  holdings: Application['library']['holdings'],
  window: BrowserWindow,
): WindowMethods<keyof HoldingsWindowApi> {
  const { directories, files, profiles, launchConfigs } = holdings
  return {
    'library.holdings.choosePath': windowMethod('control', async ([kind]) => {
      if (kind !== 'file' && kind !== 'directory') {
        throw new DesktopError('InvalidInput', 'Choose a file or a directory')
      }
      const picked = await dialog.showOpenDialog(window, {
        properties: [kind === 'file' ? 'openFile' : 'openDirectory'],
      })
      return picked.canceled ? null : picked.filePaths[0]!
    }),
    'library.holdings.preferences': windowMethod('read', async ([raw, target]) => {
      const work = fileWork(raw),
        at = target as UsagePreferenceTarget
      const saved = await holdings.preferences.get(work, at)
      return rpcData({ saved, inherited: await holdings.inherited(work, at) })
    }),
    'library.holdings.updatePreferences': windowMethod(
      'write',
      async ([raw, target, input], signal) => {
        await holdings.preferences.update(
          ...([fileWork(raw), target, input, { signal }] as unknown as Parameters<
            HoldingsPreferencesApi['update']
          >),
        )
      },
    ),
    'library.files.playbackChoices': windowMethod('write', ([anime, file, input], signal) =>
      files.playbackChoices.update(
        textArgument(anime),
        textArgument(file),
        parseFilePlaybackChoicesUpdate(input),
        { signal },
      ),
    ),
    'library.holdings.register': windowMethod('write', async ([work, input], signal) =>
      rpcData(await holdings.registerLocalContent(parseWorkRef(work), input, {}, { signal })),
    ),
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
    'library.holdings.refresh': windowMethod('write', async ([work], signal) =>
      rpcData(await holdings.refresh(fileWork(work), { signal })),
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

    'library.profiles.explain': windowMethod(
      'read',
      async ([type, definition, name, path], signal) =>
        rpcData(
          await holdings.recognition.explain(
            fileMedium(type),
            definition,
            textArgument(name),
            path === null ? undefined : textArgument(path),
            signal,
          ),
        ),
    ),
    'library.profiles.list': windowMethod('read', async ([type]) =>
      rpcData(await profiles.list(fileMedium(type))),
    ),
    'library.profiles.get': windowMethod('read', async ([type, id]) =>
      rpcData(await profiles.get(fileMedium(type), textArgument(id))),
    ),
    'library.profiles.references': windowMethod('read', async ([type, id]) =>
      rpcData(await profiles.references(fileMedium(type), textArgument(id))),
    ),
    'library.profiles.presets': windowMethod('read', ([type]) =>
      rpcData(profiles.presets(fileMedium(type))),
    ),
    'library.profiles.create': windowMethod('write', async ([type, input], signal) =>
      rpcData(await profiles.create(fileMedium(type), input, signal)),
    ),
    'library.profiles.update': windowMethod('write', async ([type, id, input], signal) =>
      rpcData(await profiles.update(fileMedium(type), textArgument(id), input, signal)),
    ),
    'library.profiles.delete': windowMethod('write', ([type, id], signal) =>
      profiles.delete(fileMedium(type), textArgument(id), signal),
    ),
    'library.profiles.reorder': windowMethod('write', ([type, input], signal) =>
      profiles.reorder(fileMedium(type), input, signal),
    ),
    'library.configs.openLocation': windowMethod('control', async ([raw, id]) => {
      const config = await launchConfigs.get(textArgument(raw), textArgument(id))
      if (!config || config.definition.status !== 'ready') {
        throw new DesktopError('NotFound', 'The launch configuration is unavailable')
      }
      const { launch } = config.definition.value
      if (launch.type === 'command') {
        const directory = launch.workingDirectory ?? homedir()
        if (!(await stat(directory)).isDirectory()) {
          throw new DesktopError('FileUnavailable', 'The working directory is unavailable')
        }
        const error = await shell.openPath(directory)
        if (error) {
          throw new DesktopError('OpenFailed', error)
        }
      } else if (launch.type === 'file' && launch.path) {
        if (!(await stat(launch.path)).isFile()) {
          throw new DesktopError('FileUnavailable', 'The launch file is unavailable')
        }
        shell.showItemInFolder(launch.path)
      } else {
        throw new DesktopError('InvalidInput', 'This launch target has no local file')
      }
    }),
    'library.configs.list': windowMethod('read', async ([game]) =>
      rpcData(await launchConfigs.list(textArgument(game))),
    ),
    'library.configs.get': windowMethod('read', async ([game, id]) =>
      rpcData(await launchConfigs.get(textArgument(game), textArgument(id))),
    ),
    'library.configs.create': windowMethod('write', ([game, input], signal) =>
      launchConfigs.create(textArgument(game), input, { signal }),
    ),
    'library.configs.update': windowMethod('write', ([game, id, input], signal) =>
      launchConfigs.update(textArgument(game), textArgument(id), input, { signal }),
    ),
    'library.configs.delete': windowMethod('write', ([game, id], signal) =>
      launchConfigs.delete(textArgument(game), textArgument(id), { signal }),
    ),
    'library.configs.reorder': windowMethod('write', ([game, input], signal) =>
      launchConfigs.reorder(textArgument(game), input, { signal }),
    ),
    'library.configs.prefer': windowMethod('write', ([game, id, expected], signal) =>
      launchConfigs.setPreferred(
        textArgument(game),
        id === null ? null : textArgument(id),
        {
          expected: { preferredLaunchConfigId: expected === null ? null : textArgument(expected) },
        },
        { signal },
      ),
    ),
  }
}
