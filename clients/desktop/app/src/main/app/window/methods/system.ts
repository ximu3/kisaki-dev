import { parseDataModeChange } from '@kisaki3/desktop-contracts/app'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { rpcData } from '../../../../shared/window-api/protocol'
import type { Application } from '../../compose'
import { toggle } from '../values'
import { windowMethod, type WindowMethodGroup } from '../admission'

export function createSystemMethods(system: Application['system']): WindowMethodGroup<'system'> {
  return {
    'system.get': windowMethod('read', async (_, signal) =>
      rpcData(await system.getState({ signal })),
    ),
    'system.login': windowMethod('write', async ([enable], signal) =>
      rpcData(await system.setLoginItem(toggle(enable), { signal })),
    ),
    'system.protocol': windowMethod('write', async (_, signal) =>
      rpcData(await system.registerProtocol({ signal })),
    ),
    'system.desktopEntry': windowMethod('write', async (_, signal) =>
      rpcData(await system.registerDesktopEntry({ signal })),
    ),
    'system.settings': windowMethod('acquire', async ([target], signal) => {
      if (target !== 'loginItem' && target !== 'protocol') {
        throw new DesktopError('InvalidInput', 'Unknown registration')
      }
      await system.openSettings(target, { signal })
    }),
    'system.portable': windowMethod('write', async ([change], signal) =>
      rpcData(await system.setDataMode(parseDataModeChange(change), { signal })),
    ),
  }
}
