import {
  type HoldingsPreferencesApi,
  type UsagePreferenceTarget,
} from '@kisaki3/desktop-contracts/library'
import { rpcData } from '../../../../../../shared/window-api/protocol'
import { fileWork } from '../../../../../features/library/holdings'
import type { Application } from '../../../../compose'
import { windowMethod } from '../../../admission'

export function holdingPreferenceMethods(holdings: Application['library']['holdings']) {
  return {
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
  }
}
