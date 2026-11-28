import { stat } from 'node:fs/promises'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  WorkRef,
  DirectoryCreateFields,
  ExternalIdentity,
} from '@kisaki3/desktop-contracts/library'
import type { NativeFiles } from '#native'
import type { DatabaseCall } from '../../../../infrastructure/database/executor'
import { normalizeAbsolutePath } from '../../../../infrastructure/files'
import { existingPosition } from '../paths'
import type { CompleteWrite } from '../../transaction'
import type { holdingStorage } from '../storage'
import type { directoryCommands } from './commands'

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
    const path = normalizeAbsolutePath(input.path)
    const info = await stat(path).catch((cause: unknown) => {
      throw new DesktopError('FileUnavailable', 'The selected directory could not be opened', {
        cause,
      })
    })
    if (!info.isDirectory()) {
      throw new DesktopError('InvalidInput', 'Choose a directory')
    }
    const baseline = await call('libraryPositions', work)
    const found = await existingPosition(
      baseline,
      work,
      { kind: 'directory', path },
      native,
      signal,
    )
    signal.throwIfAborted()
    const result = complete(
      await call('registerDirectory', work, { ...input, path }, baseline, found, identities),
    )
    if (result.created) {
      positionsChanged()
    }
    return result
  }
}
