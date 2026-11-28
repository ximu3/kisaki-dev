import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { Application } from '../../../compose'
import { rpcData } from '../../../../../shared/window-api/protocol'
import { windowMethod } from '../../admission'
import { textArgument } from '../../values'
import { toggle } from '../../values'
export function relationMethods(relations: Application['library']['relations']) {
  function relation(value: unknown) {
    if (typeof value !== 'string' || !Object.hasOwn(relations, value)) {
      throw new DesktopError('InvalidInput', 'Invalid relationship family')
    }
    return relations[value as keyof typeof relations]
  }
  return {
    'library.relations.list': windowMethod('read', async ([family, scope, range, spoilers]) =>
      rpcData(await relation(family).listVisible(scope, range, toggle(spoilers))),
    ),
    'library.relations.get': windowMethod('read', async ([family, id, spoilers]) =>
      rpcData(await relation(family).getVisible(textArgument(id), toggle(spoilers))),
    ),
    'library.relations.create': windowMethod('write', ([family, input], signal) =>
      relation(family).create(input, { signal }),
    ),
    'library.relations.update': windowMethod('write', ([family, id, input], signal) =>
      relation(family).update(textArgument(id), input, { signal }),
    ),
    'library.relations.delete': windowMethod('write', ([family, id], signal) =>
      relation(family).delete(textArgument(id), { signal }),
    ),
    'library.relations.reorder': windowMethod('write', ([family, scope, input], signal) =>
      relation(family).reorder(scope, input, { signal }),
    ),
  }
}
