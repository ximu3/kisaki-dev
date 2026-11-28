import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { shell } from 'electron'
import { stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { rpcData } from '../../../../../../shared/window-api/protocol'
import type { Application } from '../../../../compose'
import { windowMethod } from '../../../admission'
import { textArgument } from '../../../values'

export function launchConfigMethods(
  launchConfigs: Application['library']['holdings']['launchConfigs'],
) {
  return {
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
