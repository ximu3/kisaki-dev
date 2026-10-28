/**
 * @fileoverview Selects runtime, resource and profile locations for source and packaged
 * launches before Electron fixes its paths.
 */

import { app } from 'electron'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { distributionKinds } from '../../shared/distribution'
import type { DistributionKind } from '../../shared/distribution'
import { portableDataDirectory } from './portable'

/** Absolute locations fixed before browser sessions and application services start. */
export interface ApplicationPaths {
  runtimeDirectory: string
  resourceDirectory: string
  dataDirectory: string
  nativeModulePath: string
}

/** Read the carrier identity that determines which portable mode is available. */
function readDistributionKind(runtimeDirectory: string): DistributionKind {
  const value: unknown = JSON.parse(
    readFileSync(join(runtimeDirectory, 'distribution.json'), 'utf8'),
  )
  if (value && typeof value === 'object' && 'kind' in value) {
    for (const kind of distributionKinds) {
      if (value.kind === kind) return kind
    }
  }

  throw new Error('Desktop distribution identity is unavailable')
}

/** Resolve this launch's data location; portable marker errors propagate to startup. */
function resolveDataDirectory(runtimeDirectory: string, profile?: string): string {
  if (profile) return profile

  const kind = readDistributionKind(runtimeDirectory)
  const ordinaryDirectory = join(app.getPath('appData'), 'Kisaki')

  if (process.platform === 'win32') {
    if (kind === 'nsis') return ordinaryDirectory
    if (kind === 'zip') {
      return portableDataDirectory(dirname(process.execPath), 'data') ?? ordinaryDirectory
    }
  } else if (process.platform === 'darwin' && kind === 'app') {
    const applicationParent = resolve(process.execPath, '../../../..')
    return portableDataDirectory(applicationParent, 'kisaki-portable-data') ?? ordinaryDirectory
  } else if (process.platform === 'linux') {
    if (kind === 'deb' || kind === 'rpm') return ordinaryDirectory
    if (kind === 'appimage') {
      const appImage = process.env.APPIMAGE
      if (!appImage || !isAbsolute(appImage)) {
        throw new Error('The original AppImage path is unavailable')
      }

      return portableDataDirectory(dirname(appImage), 'kisaki-portable-data') ?? ordinaryDirectory
    }
  }

  throw new Error('Unsupported desktop distribution identity')
}

/** Select the data location and set Electron paths synchronously before app.ready. */
export function initializePaths(profile?: string): ApplicationPaths {
  const runtimeDirectory = app.isPackaged
    ? app.getAppPath()
    : resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const resourceDirectory = app.isPackaged
    ? join(process.resourcesPath, 'resources')
    : join(runtimeDirectory, 'resources')

  const dataDirectory = resolveDataDirectory(runtimeDirectory, profile)
  const sessionDirectory = join(dataDirectory, 'browser')

  mkdirSync(dataDirectory, { recursive: true })
  mkdirSync(sessionDirectory, { recursive: true })

  app.setPath('userData', dataDirectory)
  app.setPath('sessionData', sessionDirectory)
  app.setAppLogsPath(join(dataDirectory, 'logs'))

  return {
    runtimeDirectory,
    resourceDirectory,
    dataDirectory,
    nativeModulePath: join(resourceDirectory, 'native', 'kisaki-native.node'),
  }
}
