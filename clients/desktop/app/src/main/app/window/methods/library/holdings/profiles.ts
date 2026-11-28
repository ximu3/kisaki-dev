import { rpcData } from '../../../../../../shared/window-api/protocol'
import { fileMedium } from '../../../../../features/library/holdings/recognition/profiles'
import type { Application } from '../../../../compose'
import { windowMethod } from '../../../admission'
import { textArgument } from '../../../values'

export function recognitionProfileMethods(holdings: Application['library']['holdings']) {
  const { profiles } = holdings
  return {
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
  }
}
