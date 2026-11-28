import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { parseWorkRef } from '@kisaki3/desktop-contracts/library'
import { dialog, type BrowserWindow } from 'electron'
import type { HoldingsWindowApi } from '../../../../../../shared/window-api/library/holdings'
import { rpcData } from '../../../../../../shared/window-api/protocol'
import { fileWork } from '../../../../../features/library/holdings'
import type { Application } from '../../../../compose'
import { windowMethod, type WindowMethods } from '../../../admission'
import { directoryMethods } from './directories'
import { fileMethods } from './files'
import { launchConfigMethods } from './launch-configs'
import { holdingPreferenceMethods } from './preferences'
import { recognitionProfileMethods } from './profiles'

export function createHoldingMethods(
  holdings: Application['library']['holdings'],
  window: BrowserWindow,
): WindowMethods<keyof HoldingsWindowApi> {
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
    'library.holdings.register': windowMethod('write', async ([work, input], signal) =>
      rpcData(await holdings.registerLocalContent(parseWorkRef(work), input, {}, { signal })),
    ),
    'library.holdings.refresh': windowMethod('write', async ([work], signal) =>
      rpcData(await holdings.refresh(fileWork(work), { signal })),
    ),
    ...holdingPreferenceMethods(holdings),
    ...fileMethods(holdings),
    ...directoryMethods(holdings),
    ...recognitionProfileMethods(holdings),
    ...launchConfigMethods(holdings.launchConfigs),
  }
}
