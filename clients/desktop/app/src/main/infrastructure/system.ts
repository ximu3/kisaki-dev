/** @fileoverview Reads and applies explicit operating-system registration choices for the actual desktop carrier. */

import { app, shell } from 'electron'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify, isDeepStrictEqual } from 'node:util'
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

/** Deployment capabilities supplied by the process that selected the data root. */
interface SystemPaths {
  isolated: boolean
  runtime: string
  data: string
  carrier: string | undefined
  /** Reads the fixed root and next-start marker from their actual owner. */
  status(): DataLocationState
  /** Prepares the requested next-start storage location. */
  setDataMode(input: DataModeChange): Promise<DataLocationState>
}

/** Runs a fixed OS registration command with argument boundaries preserved. */
const execute = promisify(execFile)

/** Reads an XDG registration, preserving permission failures and distinguishing a missing file. */
async function readRegistration(path: string) {
  try {
    return await readFile(path, 'utf8')
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw cause
  }
}

/** Creates the app's registration interface without changing system settings at startup. */
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
  const desktopName = appId + '.desktop'
  const autostart = join(
    process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'),
    'autostart',
    desktopName,
  )
  const desktopFile = join(
    process.env.XDG_DATA_HOME ?? join(homedir(), '.local/share'),
    'applications',
    desktopName,
  )
  /** Quotes one executable or argument for the desktop entry's Exec field. */
  const quote = (value: string) =>
    '"' +
    value
      .replace(/([\\"$`])/g, '\\$1')
      .replaceAll('\\', '\\\\')
      .replaceAll('\n', '\\n')
      .replaceAll('\r', '\\r')
      .replaceAll('%', '%%') +
    '"'
  const launch = [executable, ...args].map(quote).join(' ')
  const header = '[Desktop Entry]\nType=Application\nName=Kisaki\n'
  const loginFile = header + 'Exec=' + launch + ' --login\n'
  const entryFile = header + 'Exec=' + launch + ' %U\nMimeType=x-scheme-handler/' + scheme + ';\n'

  /** Reads registration separately from operating-system approval to start it. */
  async function loginItem(): Promise<LoginItemState> {
    try {
      if (process.platform === 'linux') {
        return {
          status: 'available',
          registered: (await readRegistration(autostart)) === loginFile,
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
      const item = info.launchItems.find(
        (item) =>
          item.path.toLowerCase() === executable.toLowerCase() &&
          isDeepStrictEqual(item.args, loginArgs),
      )
      return {
        status: 'available',
        registered: !!item,
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

  /** Checks whether the movable Linux carrier has its own usable application entry. */
  async function desktopEntry(): Promise<DesktopEntryState> {
    if (process.platform !== 'linux' || paths.carrier !== 'appimage') {
      return { status: 'notApplicable' }
    }
    try {
      return {
        status: 'available',
        registered: (await readRegistration(desktopFile)) === entryFile,
      }
    } catch {
      return {
        status: 'unavailable',
        error: { code: 'ReadFailed', message: 'The desktop entry could not be read' },
      }
    }
  }

  /** Reads the selected handler; on Linux the desktop file and the MIME association are independent. */
  async function protocol(): Promise<ProtocolIntegrationState> {
    try {
      const nativeRegistration = app.isDefaultProtocolClient(scheme, executable, args)
      const entry = await desktopEntry()
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
        isDefault = stdout.trim() === desktopName
        if (entry.status === 'notApplicable') {
          const roots = [
            process.env.XDG_DATA_HOME ?? join(homedir(), '.local/share'),
            ...(process.env.XDG_DATA_DIRS ?? '/usr/local/share:/usr/share').split(':'),
          ]
          registered = false
          for (const root of roots) {
            const content = await readRegistration(join(root, 'applications', desktopName))
            if (
              content?.split(/\r?\n/).some(
                (line) =>
                  line.startsWith('MimeType=') &&
                  line
                    .slice(9)
                    .split(';')
                    .includes('x-scheme-handler/' + scheme),
              )
            ) {
              registered = true
              break
            }
          }
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

  /** Publishes the explicit Linux registration while preserving entries owned by other programs. */
  async function writeEntry(path: string, contents: string) {
    const old = await readRegistration(path)
    if (old !== null && old !== contents) {
      throw new DesktopError('Conflict', 'This desktop entry belongs to another launcher')
    }
    if (old === null) {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, contents, { flag: 'wx' })
    }
  }

  return {
    /** Reads the actual OS registrations and data-root selection together. */
    async getState() {
      const [login, handler, desktop] = await Promise.all([loginItem(), protocol(), desktopEntry()])
      return {
        loginItem: login,
        protocol: handler,
        desktopEntry: desktop,
        dataLocation: paths.status(),
      }
    },
    /** Applies the selected login registration then rereads it. */
    async setLoginItem(enabled) {
      if (process.platform === 'linux') {
        if (enabled) {
          await writeEntry(autostart, loginFile)
        } else if ((await readRegistration(autostart)) === loginFile) {
          await rm(autostart)
        }
      } else {
        app.setLoginItemSettings({ openAtLogin: enabled, path: executable, args: loginArgs })
      }
      return loginItem()
    },
    /** Registers this carrier's scheme and returns the resulting association. */
    async registerDesktopEntry() {
      if (process.platform === 'linux' && paths.carrier === 'appimage') {
        await writeEntry(desktopFile, entryFile)
      }
      return desktopEntry()
    },
    /** Creates the user desktop entry for a supported movable carrier. */
    async registerProtocol() {
      if (process.platform === 'linux') {
        if (paths.carrier === 'appimage' || !app.isPackaged) {
          await writeEntry(desktopFile, entryFile)
        }
        await execute('xdg-mime', ['default', desktopName, 'x-scheme-handler/' + scheme])
      } else if (!app.setAsDefaultProtocolClient(scheme, executable, args)) {
        throw new DesktopError('OperationFailed', 'The protocol could not be registered')
      }
      return protocol()
    },
    /** Opens the OS settings appropriate to the chosen integration. */
    async openSettings(target) {
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
    /** Delegates the explicit existing-or-empty choice to the data-path owner. */
    async setDataMode(input) {
      return paths.setDataMode(input)
    },
  }
}
