import type { NativeFiles } from '#native'
import type {
  DirectoryCreateFields,
  ExternalIdentity,
  WorkRef,
} from '@kisaki3/desktop-contracts/library'
import type { DatabaseCall } from '../../../../infrastructure/database/executor'
import type { CompleteWrite } from '../../transaction'
import type { Position } from '../paths'
import { existingPosition } from '../paths'
import type { holdingStorage } from '../storage'
import { inspectDirectory } from './inspect'
import type { directoryCommands } from './storage'

export function createDirectoryRegistration(
  call: DatabaseCall<
    ReturnType<typeof directoryCommands> &
      Pick<ReturnType<typeof holdingStorage>, 'libraryPositions'>
  >,
  complete: CompleteWrite,
  native: NativeFiles,
  positionsChanged: () => void,
) {
  return async function (
    work: WorkRef,
    input: DirectoryCreateFields,
    signal: AbortSignal,
    identities?: readonly ExternalIdentity[],
  ) {
    const path = await inspectDirectory(input.path)
    const baseline = await call('libraryPositions', work)
    const found = await findRegisteredDirectory(work, path, baseline, native, signal)
    const result = complete(
      await call('registerDirectory', work, { ...input, path }, baseline, found, identities),
    )
    if (result.created) {
      positionsChanged()
    }
    return result
  }
}

export async function findRegisteredDirectory(
  work: WorkRef,
  path: string,
  baseline: readonly Position[],
  native: NativeFiles,
  signal: AbortSignal,
) {
  const found = await existingPosition(baseline, work, { kind: 'directory', path }, native, signal)
  signal.throwIfAborted()
  return found
}
