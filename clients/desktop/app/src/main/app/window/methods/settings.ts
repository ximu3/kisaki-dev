import { rpcData } from '../../../../shared/window-api/protocol'
import type { Application } from '../../compose'
import { windowMethod, type WindowMethodGroup } from '../admission'

export function createSettingsMethods({
  preferences,
  i18n,
  network,
}: Pick<Application, 'preferences' | 'i18n' | 'network'>): WindowMethodGroup<
  'preferences' | 'translations' | 'network'
> {
  return {
    'preferences.get': windowMethod('read', async (_, signal) =>
      rpcData(await preferences.get({ signal })),
    ),
    'preferences.defaults': windowMethod('read', async (_, signal) =>
      rpcData(await preferences.getDefaults({ signal })),
    ),
    'preferences.fields': windowMethod('read', async (_, signal) =>
      rpcData(await preferences.listFields({ signal })),
    ),
    'preferences.update': windowMethod('write', async ([value], signal) =>
      rpcData(await preferences.update(value, { signal })),
    ),
    'translations.list': windowMethod('read', (_, signal) => rpcData(i18n.list({ signal }))),
    'network.state': windowMethod('read', async (_, signal) =>
      rpcData(await network.getState({ signal })),
    ),
  }
}
