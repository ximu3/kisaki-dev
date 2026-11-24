import { app } from 'electron'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isAbsoluteHostPath } from '#host-path'
import {
  parseDataModeChange,
  type DataModeChange,
  type DataLocationState,
} from '@kisaki3/desktop-contracts/app'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'

export function launchArgument(key: string) {
  const prefix = '--' + key + '='
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length)
}

function portableMarker(path: string) {
  const info = lstatSync(path, { throwIfNoEntry: false })
  if (!info) {
    return false
  }
  if (!info.isFile()) {
    throw new Error('The portable marker must be a regular file')
  }
  return true
}

function checkPortableRoot(path: string) {
  if (!lstatSync(path).isDirectory()) {
    throw new Error('The portable data directory is unavailable')
  }
  if (
    readdirSync(path).length &&
    !lstatSync(join(path, 'library.sqlite'), { throwIfNoEntry: false })?.isFile()
  ) {
    throw new Error('The portable library is incomplete')
  }
}

export function selectPaths() {
  const runtime = app.isPackaged
    ? app.getAppPath()
    : resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const resources = join(app.isPackaged ? process.resourcesPath : runtime, 'resources')
  const distribution = app.isPackaged
    ? (JSON.parse(readFileSync(join(runtime, 'distribution.json'), 'utf8')) as {
        kind: string
        testOnly: boolean
      })
    : null
  const isolated = distribution === null || distribution.testOnly
  const requested = isolated ? launchArgument('profile') : undefined
  if (requested && !isAbsoluteHostPath(requested)) {
    throw new Error('An isolated profile must be an absolute path')
  }
  if (distribution?.testOnly && !requested) {
    throw new Error('This test candidate requires an isolated profile')
  }
  const normal = isolated
    ? (requested ?? resolve('.local', 'development'))
    : join(app.getPath('appData'), 'Kisaki')
  let carrier: string | undefined
  switch (distribution?.kind) {
    case 'zip':
      carrier = dirname(process.execPath)
      break
    case 'app':
      carrier = resolve(dirname(process.execPath), '../../..')
      break
    case 'appimage':
      if (!process.env.APPIMAGE) {
        throw new Error('The AppImage carrier path is unavailable')
      }
      carrier = dirname(process.env.APPIMAGE)
      break
    case undefined:
    default:
      break
  }
  const marker = carrier ? join(carrier, 'kisaki-portable.txt') : undefined
  const portable = carrier
    ? join(carrier, process.platform === 'win32' ? 'data' : 'kisaki-portable-data')
    : undefined
  const selected = !!marker && portableMarker(marker)
  const data = selected ? portable! : normal
  if (selected) {
    checkPortableRoot(data)
  } else {
    mkdirSync(data, { recursive: true })
  }
  const browser = join(data, 'browser')
  mkdirSync(browser, { recursive: true })
  app.setPath('userData', data)
  app.setPath('sessionData', browser)
  app.setAppLogsPath(join(data, 'logs'))
  return {
    runtime,
    resources,
    data,
    isolated,
    carrier: distribution?.kind,
    status(): DataLocationState {
      const current = { mode: selected ? ('portable' as const) : ('normal' as const), path: data }
      if (!marker || !portable) {
        return { current, normalPath: normal, portable: { status: 'unsupported' } }
      }
      try {
        return {
          current,
          normalPath: normal,
          portable: {
            status: 'available',
            path: portable,
            nextMode: portableMarker(marker) ? 'portable' : 'normal',
          },
        }
      } catch {
        return {
          current,
          normalPath: normal,
          portable: {
            status: 'unavailable',
            error: { code: 'ReadFailed', message: 'The portable marker could not be read' },
          },
        }
      }
    },
    async setDataMode(
      input: DataModeChange,
      verify: (directory: string, existing: boolean) => Promise<void>,
      signal?: AbortSignal,
    ) {
      const { mode, target } = parseDataModeChange(input)
      if (!marker || !portable) {
        throw new DesktopError('InvalidInput', 'This carrier does not support portable mode')
      }
      const destination = mode === 'portable' ? portable : normal
      if (target === 'empty') {
        if (!existsSync(destination)) {
          mkdirSync(destination, { recursive: true })
        }
        if (!lstatSync(destination).isDirectory() || readdirSync(destination).length) {
          throw new DesktopError('Conflict', 'The selected location is not an empty directory')
        }
      } else if (
        !lstatSync(join(destination, 'library.sqlite'), { throwIfNoEntry: false })?.isFile()
      ) {
        throw new DesktopError('NotFound', 'The selected location has no existing library')
      }
      await verify(destination, target === 'existing')
      signal?.throwIfAborted()
      if (mode === 'portable') {
        if (!portableMarker(marker)) {
          writeFileSync(marker, '', { flag: 'wx' })
        }
      } else if (portableMarker(marker)) {
        rmSync(marker)
      }
      return this.status()
    },
  }
}

export type AppPaths = ReturnType<typeof selectPaths>
