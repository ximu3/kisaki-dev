import type { ViewResourcesApi } from '@kisaki3/desktop-contracts/resources'
import { rpcData } from '../../../../shared/window-api/protocol'
import type { Application } from '../../compose'
import type { DocumentResources } from '../resources'
import { windowMethod, type WindowMethodGroup } from '../admission'

export function createAppearanceMethods(
  appearance: Application['appearance'],
  view: ViewResourcesApi,
  resources: DocumentResources,
): WindowMethodGroup<'appearance'> {
  return {
    'appearance.get': windowMethod('acquire', async (_, signal) => {
      const read = await appearance.forView(view, { signal })
      return rpcData({
        value: read.appearance,
        fontFamilies: read.fontFamilies,
        issues: read.issues,
        hold: await resources.keep(read, signal),
      })
    }),
    'appearance.base': windowMethod('read', async () => rpcData(await appearance.base())),
  }
}
