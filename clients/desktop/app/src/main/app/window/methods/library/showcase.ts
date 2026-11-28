import type { Application } from '../../../compose'
import { rpcData } from '../../../../../shared/window-api/protocol'
import { windowMethod } from '../../admission'
import { textArgument } from '../../values'
export function showcaseMethods(showcase: Application['library']['showcase']) {
  return {
    'library.showcase.list': windowMethod('read', async () => rpcData(await showcase.list())),
    'library.showcase.get': windowMethod('read', async ([id]) =>
      rpcData(await showcase.get(textArgument(id))),
    ),
    'library.showcase.listPresets': windowMethod('read', async () =>
      rpcData(await showcase.listPresets()),
    ),
    'library.showcase.create': windowMethod('write', async ([raw], signal) =>
      rpcData(await showcase.create(raw, { signal })),
    ),
    'library.showcase.createMany': windowMethod('write', async ([raw], signal) =>
      rpcData(await showcase.createMany(raw, { signal })),
    ),
    'library.showcase.update': windowMethod('write', async ([id, raw], signal) =>
      rpcData(await showcase.update(textArgument(id), raw, { signal })),
    ),
    'library.showcase.delete': windowMethod('write', ([id], signal) =>
      showcase.delete(textArgument(id), { signal }),
    ),
    'library.showcase.reorder': windowMethod('write', ([raw], signal) =>
      showcase.reorder(raw, { signal }),
    ),
  }
}
