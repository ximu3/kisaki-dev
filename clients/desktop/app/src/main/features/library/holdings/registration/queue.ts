import type { NativeFiles } from '#native'
import type { DatabaseCall } from '../../../../infrastructure/database/executor'
import type { ChangeAdmission } from '../../change-admission'
import type { CompleteWrite } from '../../transaction'
import type { holdingStorage } from '../storage'
import type { launchConfigStorage } from '../game/configuration/storage'
import { createDirectoryRegistration } from '../directories/register'
import { createFileRegistration } from '../files/register'
import { createGameRegistration } from '../game/configuration/register'

export function createRegistration(
  call: DatabaseCall<ReturnType<typeof holdingStorage> & ReturnType<typeof launchConfigStorage>>,
  complete: CompleteWrite,
  native: NativeFiles,
  resources: string,
  admit: ChangeAdmission,
  positionsChanged: () => void,
) {
  const pending = new Map<string, Promise<void>>()
  function serialize<T extends { id: string }, Args extends unknown[], R>(
    action: (work: T, ...args: Args) => Promise<R>,
  ) {
    return async (work: T, ...args: Args) => {
      const result = (pending.get(work.id) ?? Promise.resolve()).then(() => action(work, ...args))
      const drained = result.then(
        () => {},
        () => {},
      )
      pending.set(work.id, drained)
      try {
        return await result
      } finally {
        if (pending.get(work.id) === drained) {
          pending.delete(work.id)
        }
      }
    }
  }
  return {
    directory: serialize(createDirectoryRegistration(call, complete, native, positionsChanged)),
    file: serialize(
      createFileRegistration(call, complete, native, resources, admit, positionsChanged),
    ),
    game: serialize(createGameRegistration(call, complete, native)),
  }
}
