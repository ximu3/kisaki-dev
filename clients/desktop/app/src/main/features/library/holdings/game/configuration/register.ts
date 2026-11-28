import { access, stat } from 'node:fs/promises'
import { constants } from 'node:fs'
import { basename, extname } from 'node:path'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  WorkRef,
  ExternalIdentity,
  LocalContentRegistrationResult,
} from '@kisaki3/desktop-contracts/library'
import type { NativeFiles } from '#native'
import type { DatabaseCall } from '../../../../../infrastructure/database/executor'
import { normalizeAbsolutePath } from '../../../../../infrastructure/files'
import { registeredRelation as comparePaths } from '../../../../../infrastructure/files/registered-path'
import type { CompleteWrite } from '../../../transaction'
import type { launchConfigStorage } from './storage'

export function createGameRegistration(
  call: DatabaseCall<ReturnType<typeof launchConfigStorage>>,
  complete: CompleteWrite,
  native: NativeFiles,
) {
  return async function (
    work: WorkRef<'game'>,
    raw: string,
    signal: AbortSignal,
    identities?: readonly ExternalIdentity[],
  ): Promise<LocalContentRegistrationResult<'game'>> {
    const path = normalizeAbsolutePath(raw)
    const info = await stat(path).catch((cause: unknown) => {
      throw new DesktopError('FileUnavailable', 'The launch file could not be accessed', { cause })
    })
    if (!info.isFile()) {
      throw new DesktopError('InvalidInput', 'Choose a file launch target')
    }
    if (process.platform === 'win32') {
      if (!['.exe', '.com', '.bat', '.cmd', '.lnk'].includes(extname(path).toLowerCase())) {
        throw new DesktopError('InvalidInput', 'Choose an executable or a system launcher')
      }
    } else {
      await access(path, constants.X_OK).catch((cause: unknown) => {
        throw new DesktopError('FileUnavailable', 'The launch file is not executable', { cause })
      })
    }
    const configs = await call('listGameConfigs', work.id, true),
      same: string[] = []
    for (const item of configs) {
      if (item.definition.status !== 'ready') {
        continue
      }
      const launch = item.definition.value.launch
      if (launch.type !== 'file' || !launch.path) {
        continue
      }
      const position = await comparePaths(launch.path, path, native)
      if (position === 'unknown') {
        throw new DesktopError('PathUnresolved', 'The registered launch path cannot be compared')
      }
      if (position === 'same') {
        same.push(item.id)
      }
    }
    signal.throwIfAborted()
    return complete(
      await call('registerGameTarget', work, path, basename(path), configs, same, identities),
    )
  }
}
