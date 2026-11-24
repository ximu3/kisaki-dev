import { createRequire } from 'node:module'
import { isAbsoluteHostPath } from '#host-path'
import { createNativeFiles, type NativeFiles } from './files'
import type * as Binding from './binding'

export interface NativeCapabilities {
  files: NativeFiles
  listFontFamilies: typeof Binding.listFontFamilies
  setNotificationReceiver: typeof Binding.setNotificationReceiver
  postNotification(appId: string, identifier: string, title: string, body: string): Promise<boolean>
}

export class NativeLoadError extends Error {
  constructor(cause: unknown) {
    super('Could not load the desktop native module', { cause })
    this.name = 'NativeLoadError'
  }
}

export function loadNative(modulePath: string): NativeCapabilities {
  if (!isAbsoluteHostPath(modulePath)) {
    throw new TypeError('Expected an absolute native module path')
  }

  try {
    const binding = createRequire(import.meta.url)(modulePath) as typeof Binding
    if (
      typeof binding.moveNoReplace !== 'function' ||
      typeof binding.syncFile !== 'function' ||
      typeof binding.getFilesystemLocation !== 'function' ||
      typeof binding.sameDirectoryEntry !== 'function' ||
      typeof binding.listFontFamilies !== 'function' ||
      typeof binding.setNotificationReceiver !== 'function' ||
      typeof binding.postSystemNotification !== 'function'
    ) {
      throw new TypeError('The native module does not provide the required capabilities')
    }

    return {
      files: createNativeFiles(binding),
      listFontFamilies: binding.listFontFamilies,
      setNotificationReceiver: binding.setNotificationReceiver,
      postNotification(appId, identifier, title, body) {
        return new Promise((resolve, reject) => {
          binding.postSystemNotification(appId, identifier, title, body, (error, accepted) => {
            if (error) {
              reject(error)
            } else {
              resolve(accepted === true)
            }
          })
        })
      },
    }
  } catch (cause) {
    throw new NativeLoadError(cause)
  }
}
