import { app, shell } from 'electron'
import { dirname, join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { linuxDesktopEntries } from './desktop-entry'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  applicationIdentities,
  type DataLocationState,
  type DataModeChange,
  type SystemIntegrationApi,
  type LoginItemState,
  type ProtocolIntegrationState,
  type DesktopEntryState,
} from '@kisaki3/desktop-contracts/app'

interface SystemPaths {
  isolated: boolean
  runtime: string
  data: string
  carrier: string | undefined
  status(): DataLocationState
  setDataMode(input: DataModeChange, signal?: AbortSignal): Promise<DataLocationState>
}

const execute = promisify(execFile)

export function systemIntegration(paths: SystemPaths): SystemIntegrationApi {
  const { scheme, appId } = applicationIdentities[paths.isolated ? 'development' : 'production']
  const args = app.isPackaged ? [] : [join(paths.runtime, 'main', 'entry.js')]
  if (paths.isolated) {
    args.push('--profile=' + paths.data)
  }
  const loginArgs = [...args, '--login']
  const executable =
    process.platform === 'linux' && paths.carrier === 'appimage'
      ? process.env.APPIMAGE!
      : process.execPath
  const entries = linuxDesktopEntries({
    appId,
    scheme,
    executable,
    args,
    profile: paths.isolated ? paths.data : undefined,
  })

  async function loginItem(): Promise<LoginItemState> {
    try {
      if (process.platform === 'linux') {
        return {
          status: 'available',
          registered: await entries.hasLoginItem(),
          permission: 'notApplicable',
          settingsAvailable: false,
        }
      }
      const info = app.getLoginItemSettings({ path: executable, args: loginArgs })
      if (process.platform === 'darwin') {
        const registered = info.status === 'enabled' || info.status === 'requires-approval'
        return {
          status: 'available',
          registered,
          permission: info.status === 'requires-approval' ? 'requiresApproval' : 'allowed',
          settingsAvailable: true,
        }
      }
      // openAtLogin compares the complete command. launchItems exposes enabled state but its
      // arguments come from Chromium's positional GetArgs(), which excludes switches.
      const item = info.launchItems.find(
        (item) =>
          item.name === appId &&
          item.scope === 'user' &&
          item.path.toLowerCase() === executable.toLowerCase(),
      )
      return {
        status: 'available',
        registered: info.openAtLogin,
        permission: item?.enabled === false ? 'denied' : 'allowed',
        settingsAvailable: true,
      }
    } catch {
      return {
        status: 'unavailable',
        error: { code: 'ReadFailed', message: 'The startup registration could not be read' },
      }
    }
  }

  async function desktopEntry(): Promise<DesktopEntryState> {
    if (process.platform !== 'linux' || paths.carrier !== 'appimage') {
      return { status: 'notApplicable' }
    }
    try {
      return {
        status: 'available',
        registered: await entries.isRegistered(),
      }
    } catch {
      return {
        status: 'unavailable',
        error: { code: 'ReadFailed', message: 'The desktop entry could not be read' },
      }
    }
  }

  async function protocol(entry: DesktopEntryState): Promise<ProtocolIntegrationState> {
    try {
      const nativeRegistration = app.isDefaultProtocolClient(scheme, executable, args)
      let registered = entry.status === 'available' ? entry.registered : nativeRegistration
      let isDefault: boolean | null = nativeRegistration
      if (process.platform === 'win32') {
        // Electron checks the launch command for registration; the OS association can differ.
        const effective = await app.getApplicationInfoForProtocol(scheme + '://').catch(() => null)
        isDefault = effective
          ? resolve(effective.path).toLowerCase() === resolve(executable).toLowerCase()
          : null
        if (app.isPackaged && isDefault) {
          registered = true
        }
        if (!app.isPackaged && isDefault) {
          isDefault = registered ? null : false
        }
      } else if (process.platform === 'darwin' && !nativeRegistration) {
        const script =
          "ObjC.import('AppKit');const urls=$.NSWorkspace.sharedWorkspace.URLsForApplicationsToOpenURL($.NSURL.URLWithString('" +
          scheme +
          "://'));JSON.stringify(Array.from({length:Number(urls.count)},(_,i)=>ObjC.unwrap(urls.objectAtIndex(i).path)))"
        const { stdout } = await execute('osascript', ['-l', 'JavaScript', '-e', script])
        const bundles = JSON.parse(stdout) as string[]
        registered = bundles.includes(resolve(dirname(executable), '../..'))
      } else if (process.platform === 'linux') {
        const { stdout } = await execute('xdg-mime', [
          'query',
          'default',
          'x-scheme-handler/' + scheme,
        ])
        isDefault = stdout.trim() === entries.name
        if (entry.status === 'notApplicable') {
          registered = await entries.hasProtocolHandler()
        }
      }
      return {
        status: 'available',
        scheme,
        registered,
        isDefault,
        settingsAvailable: process.platform === 'win32',
      }
    } catch {
      return {
        status: 'unavailable',
        error: { code: 'ReadFailed', message: 'The protocol association could not be read' },
      }
    }
  }

  return {
    async getState(options) {
      options?.signal?.throwIfAborted()
      const desktop = desktopEntry()
      const [login, handler, entry] = await Promise.all([
        loginItem(),
        desktop.then(protocol),
        desktop,
      ])
      return {
        loginItem: login,
        protocol: handler,
        desktopEntry: entry,
        dataLocation: paths.status(),
      }
    },
    async setLoginItem(enabled, options) {
      options?.signal?.throwIfAborted()
      if (process.platform === 'linux') {
        await entries.setLoginItem(enabled, options?.signal)
      } else {
        app.setLoginItemSettings({ openAtLogin: enabled, path: executable, args: loginArgs })
      }
      return loginItem()
    },
    async registerDesktopEntry(options) {
      options?.signal?.throwIfAborted()
      if (process.platform === 'linux' && paths.carrier === 'appimage') {
        await entries.register(options?.signal)
      }
      return desktopEntry()
    },
    async registerProtocol(options) {
      options?.signal?.throwIfAborted()
      if (process.platform === 'linux') {
        if (paths.carrier === 'appimage' || !app.isPackaged) {
          await entries.register(options?.signal)
        }
        await execute('xdg-mime', ['default', entries.name, 'x-scheme-handler/' + scheme])
      } else if (!app.setAsDefaultProtocolClient(scheme, executable, args)) {
        throw new DesktopError('OperationFailed', 'The protocol could not be registered')
      }
      return protocol(await desktopEntry())
    },
    async openSettings(target, options) {
      options?.signal?.throwIfAborted()
      if (process.platform === 'win32') {
        await shell.openExternal(
          target === 'loginItem' ? 'ms-settings:startupapps' : 'ms-settings:defaultapps',
        )
      } else if (process.platform === 'darwin' && target === 'loginItem') {
        await shell.openExternal(
          'x-apple.systempreferences:com.apple.LoginItems-Settings.extension',
        )
      } else {
        throw new DesktopError(
          'OperationFailed',
          'System settings are unavailable for this registration',
        )
      }
    },
    async setDataMode(input, options) {
      options?.signal?.throwIfAborted()
      return paths.setDataMode(input, options?.signal)
    },
  }
}
