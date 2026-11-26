import { parseTaskRunRef, type TaskState } from '@kisaki3/desktop-contracts/tasks'
import { rpcData } from '../../../../shared/window-api/protocol'
import type { Application } from '../../compose'
import type { DocumentResources } from '../resources'
import { windowMethod, type WindowMethodGroup } from '../admission'

export function createTaskMethods(
  tasks: Application['tasks'],
  resources: DocumentResources,
  notifyState: (state: TaskState) => void,
): WindowMethodGroup<'tasks'> {
  return {
    'tasks.list': windowMethod('read', async ([query, options], signal) =>
      rpcData(await tasks.list(query, options, { signal })),
    ),
    'tasks.get': windowMethod('read', async ([ref], signal) =>
      rpcData(await tasks.get(parseTaskRunRef(ref), { signal })),
    ),
    'tasks.types': windowMethod('read', async () => rpcData(await tasks.types())),
    'tasks.wait': windowMethod('acquire', async ([ref], signal) =>
      rpcData(await tasks.wait(parseTaskRunRef(ref), { signal })),
    ),
    'tasks.observe': windowMethod('acquire', async ([ref], signal) =>
      resources.keep(await tasks.observe(parseTaskRunRef(ref), notifyState, { signal }), signal),
    ),
    'tasks.pause': windowMethod('acquire', async ([ref], signal) =>
      rpcData(await tasks.pause(parseTaskRunRef(ref), { signal })),
    ),
    'tasks.resume': windowMethod('control', async ([ref], signal) =>
      rpcData(await tasks.resume(parseTaskRunRef(ref), { signal })),
    ),
    'tasks.cancel': windowMethod('control', async ([ref], signal) =>
      rpcData(await tasks.cancel(parseTaskRunRef(ref), { signal })),
    ),
    'tasks.clear': windowMethod('write', async (_, signal) => tasks.clearHistory({}, { signal })),
    'tasks.delete': windowMethod('write', async ([ref], signal) =>
      tasks.deleteHistory(parseTaskRunRef(ref), { signal }),
    ),
  }
}
