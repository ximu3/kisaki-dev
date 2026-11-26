import type { ApplicationExitApi } from '@kisaki3/desktop-contracts/app'
import { rpcData } from '../../../../shared/window-api/protocol'
import { environment, copyEnvironment } from '../../../infrastructure/environment'
import { windowMethod, type WindowMethodGroup } from '../admission'

export function createApplicationMethods(
  lifecycle: ApplicationExitApi,
  restart: () => void,
): WindowMethodGroup<'app'> {
  return {
    'app.restart': windowMethod('control', () => {
      setImmediate(restart)
    }),
    'app.cancelExit': windowMethod('control', (_, signal) => lifecycle.cancel({ signal })),
    'app.exitState': windowMethod('read', async (_, signal) =>
      rpcData(await lifecycle.getState({ signal })),
    ),
    'app.environment': windowMethod('read', (_, signal) => rpcData(environment({ signal }))),
    'app.copyEnvironment': windowMethod('write', (_, signal) => copyEnvironment({ signal })),
  }
}
